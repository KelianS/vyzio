using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Xml.Linq;
using Microsoft.Extensions.Logging;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.VendorAdapters;

public sealed record OnvifDeviceInfo(
    string? Manufacturer,
    string? Model,
    string? FirmwareVersion,
    string? SerialNumber);

// One ONVIF media profile. SourceToken identifies the physical video source behind it: profiles
// sharing it are quality tiers of one scene, differing ones are separate lenses (ADR-38).
public sealed record OnvifMediaProfile(
    string Token,
    string? SourceToken,
    int? Width,
    int? Height,
    int? Fps);

// Pure ONVIF protocol client — SOAP over HTTP with WS-UsernameToken / PasswordDigest.
// Covers any ONVIF-compliant device: V380 Pro, Hikvision, Dahua, Reolink, Axis, etc.
// Feature orchestration (PTZ, privacy, device ID bootstrap) lives in the provider layer.
// Registered as Singleton: shared across providers, stateless (no per-camera cache here).
internal sealed class OnvifClient(
    IHttpClientFactory httpClientFactory,
    OnvifEndpointResolver endpointResolver,
    TimeProvider time,
    ILogger<OnvifClient> logger)
{
    // Short: long enough to hear a refusal, short enough not to stall a held PTZ button (ADR-56).
    private static readonly TimeSpan CommandTimeout = TimeSpan.FromMilliseconds(1500);

    // A continuous move is stopped after a short step: waiting longer than that would overshoot it.
    private static readonly TimeSpan MoveStartTimeout = TimeSpan.FromMilliseconds(300);

    // Returns device identification info from ONVIF GetDeviceInformation.
    // The SerialNumber field encodes the V380 device ID in bytes 2-5 as uint32 big-endian.
    public async Task<OnvifDeviceInfo?> GetDeviceInformationAsync(Camera camera, CancellationToken ct)
    {
        const string body = "<GetDeviceInformation xmlns=\"http://www.onvif.org/ver10/device/wsdl\"/>";
        var xml = await PostSoapAsync(camera, OnvifService.Device, body, ct);
        if (xml is null) return null;

        try
        {
            var doc = XDocument.Parse(xml);
            return new OnvifDeviceInfo(
                doc.Descendants().FirstOrDefault(e => e.Name.LocalName == "Manufacturer")?.Value,
                doc.Descendants().FirstOrDefault(e => e.Name.LocalName == "Model")?.Value,
                doc.Descendants().FirstOrDefault(e => e.Name.LocalName == "FirmwareVersion")?.Value,
                doc.Descendants().FirstOrDefault(e => e.Name.LocalName == "SerialNumber")?.Value);
        }
        catch
        {
            return null;
        }
    }

    // Returns (profileToken, ptzConfigToken) for the first media profile.
    public async Task<(string ProfileToken, string PtzConfigToken)> GetFirstProfileAsync(Camera camera, CancellationToken ct)
    {
        const string body = "<GetProfiles xmlns=\"http://www.onvif.org/ver10/media/wsdl\"/>";
        var xml = await PostSoapAsync(camera, OnvifService.Media, body, ct);

        var profileToken = "profile1";
        var ptzConfigToken = "ptz_config_0";

        if (xml is not null)
        {
            try
            {
                var doc = XDocument.Parse(xml);
                XNamespace trt = "http://www.onvif.org/ver10/media/wsdl";
                var profile = doc.Descendants(trt + "Profiles").FirstOrDefault();
                profileToken = profile?.Attribute("token")?.Value ?? profileToken;
                ptzConfigToken = profile?.Descendants()
                                         .FirstOrDefault(e => e.Name.LocalName == "PTZConfiguration")
                                         ?.Attribute("token")?.Value ?? ptzConfigToken;
            }
            catch { }
        }

        return (profileToken, ptzConfigToken);
    }

    // Returns every media profile with its video source and encoder settings (ADR-38). Tolerates a
    // silent camera by returning an empty list — a camera that cannot describe its streams keeps the
    // single one Vyzio already knows, it is not an error.
    public async Task<IReadOnlyList<OnvifMediaProfile>> GetMediaProfilesAsync(Camera camera, CancellationToken ct)
    {
        const string body = "<GetProfiles xmlns=\"http://www.onvif.org/ver10/media/wsdl\"/>";
        var xml = await PostSoapAsync(camera, OnvifService.Media, body, ct,
            soapAction: "http://www.onvif.org/ver10/media/wsdl/GetProfiles");
        if (xml is null) return [];

        try
        {
            var doc = XDocument.Parse(xml);
            return [.. doc.Descendants()
                .Where(element => element.Name.LocalName == "Profiles")
                .Select(ReadProfile)
                .Where(profile => profile is not null)
                .Select(profile => profile!)];
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "ONVIF GetProfiles response unreadable for {Host}.", camera.Host);
            return [];
        }
    }

    private static OnvifMediaProfile? ReadProfile(XElement profile)
    {
        var token = profile.Attribute("token")?.Value;
        if (string.IsNullOrWhiteSpace(token)) return null;

        var sourceToken = Child(profile, "VideoSourceConfiguration") is { } source
            ? Child(source, "SourceToken")?.Value
            : null;

        int? width = null, height = null, fps = null;
        if (Child(profile, "VideoEncoderConfiguration") is { } encoder)
        {
            if (Child(encoder, "Resolution") is { } resolution)
            {
                width = ReadInt(Child(resolution, "Width"));
                height = ReadInt(Child(resolution, "Height"));
            }
            if (Child(encoder, "RateControl") is { } rateControl)
            {
                fps = ReadInt(Child(rateControl, "FrameRateLimit"));
            }
        }

        return new OnvifMediaProfile(token, sourceToken, width, height, fps);
    }

    // Returns the RTSP URI the camera serves a given profile on.
    public async Task<string?> GetStreamUriAsync(Camera camera, string profileToken, CancellationToken ct)
    {
        var body = $"""
            <GetStreamUri xmlns="http://www.onvif.org/ver10/media/wsdl">
              <StreamSetup>
                <Stream xmlns="http://www.onvif.org/ver10/schema">RTP-Unicast</Stream>
                <Transport xmlns="http://www.onvif.org/ver10/schema">
                  <Protocol>RTSP</Protocol>
                </Transport>
              </StreamSetup>
              <ProfileToken>{profileToken}</ProfileToken>
            </GetStreamUri>
            """;
        var xml = await PostSoapAsync(camera, OnvifService.Media, body, ct,
            soapAction: "http://www.onvif.org/ver10/media/wsdl/GetStreamUri");
        if (xml is null) return null;

        try
        {
            var uri = XDocument.Parse(xml).Descendants()
                .FirstOrDefault(element => element.Name.LocalName == "Uri")?.Value;
            return string.IsNullOrWhiteSpace(uri) ? null : uri;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "ONVIF GetStreamUri response unreadable for {Host}.", camera.Host);
            return null;
        }
    }

    private static XElement? Child(XElement parent, string localName)
        => parent.Descendants().FirstOrDefault(element => element.Name.LocalName == localName);

    // ONVIF 2.0 allows a float where a count is expected (FrameRateLimit is commonly "12.0"),
    // so parse wide and round rather than rejecting the value.
    private static int? ReadInt(XElement? element)
        => element is not null
           && double.TryParse(element.Value, NumberStyles.Float, CultureInfo.InvariantCulture, out var value)
           && value >= 1
            ? (int)Math.Round(value)
            : null;

    // Returns raw GetConfigurationOptions XML for PTZ capability detection.
    public Task<string?> GetPtzConfigurationOptionsAsync(Camera camera, string configToken, CancellationToken ct)
    {
        var body = $"""
            <GetConfigurationOptions xmlns="http://www.onvif.org/ver20/ptz/wsdl">
              <ConfigurationToken>{configToken}</ConfigurationToken>
            </GetConfigurationOptions>
            """;
        return PostSoapAsync(camera, OnvifService.Ptz, body, ct);
    }

    // Returns (pan, tilt) in ONVIF normalized space [-1, 1], or null if unsupported.
    public async Task<(float Pan, float Tilt)?> GetStatusAsync(Camera camera, string profileToken, CancellationToken ct)
    {
        var body = $"""
            <GetStatus xmlns="http://www.onvif.org/ver20/ptz/wsdl">
              <ProfileToken>{profileToken}</ProfileToken>
            </GetStatus>
            """;
        var xml = await PostSoapAsync(camera, OnvifService.Ptz, body, ct);
        if (xml is null) return null;

        try
        {
            var doc = XDocument.Parse(xml);
            XNamespace tt = "http://www.onvif.org/ver10/schema";
            var panTilt = doc.Descendants(tt + "PanTilt").FirstOrDefault();
            if (panTilt is null) return null;

            var x = panTilt.Attribute("x")?.Value;
            var y = panTilt.Attribute("y")?.Value;
            if (x is null || y is null) return null;

            if (!float.TryParse(x, NumberStyles.Float, CultureInfo.InvariantCulture, out var pan)) return null;
            if (!float.TryParse(y, NumberStyles.Float, CultureInfo.InvariantCulture, out var tilt)) return null;

            return (pan, tilt);
        }
        catch { return null; }
    }

    public Task ContinuousMoveAsync(Camera camera, string profileToken, float pan, float tilt, CancellationToken ct)
    {
        var panStr = pan.ToString("F2", CultureInfo.InvariantCulture);
        var tiltStr = tilt.ToString("F2", CultureInfo.InvariantCulture);
        var body = $"""
            <ContinuousMove xmlns="http://www.onvif.org/ver20/ptz/wsdl">
              <ProfileToken>{profileToken}</ProfileToken>
              <Velocity>
                <PanTilt x="{panStr}" y="{tiltStr}" xmlns="http://www.onvif.org/ver10/schema"/>
              </Velocity>
            </ContinuousMove>
            """;
        return SendCommandAsync(camera, OnvifService.Ptz, body, ct, wait: MoveStartTimeout);
    }

    public Task RelativeMoveAsync(Camera camera, string profileToken, float pan, float tilt, CancellationToken ct)
    {
        var panStr = pan.ToString("F4", CultureInfo.InvariantCulture);
        var tiltStr = tilt.ToString("F4", CultureInfo.InvariantCulture);
        var body = $"""
            <RelativeMove xmlns="http://www.onvif.org/ver20/ptz/wsdl">
              <ProfileToken>{profileToken}</ProfileToken>
              <Translation>
                <PanTilt x="{panStr}" y="{tiltStr}" xmlns="http://www.onvif.org/ver10/schema"/>
              </Translation>
            </RelativeMove>
            """;
        return SendCommandAsync(camera, OnvifService.Ptz, body, ct);
    }

    public Task StopAsync(Camera camera, string profileToken, CancellationToken ct)
    {
        var body = $"""
            <Stop xmlns="http://www.onvif.org/ver20/ptz/wsdl">
              <ProfileToken>{profileToken}</ProfileToken>
              <PanTilt>true</PanTilt>
              <Zoom>true</Zoom>
            </Stop>
            """;
        return SendCommandAsync(camera, OnvifService.Ptz, body, ct);
    }

    public Task SetPresetAsync(Camera camera, string profileToken, int presetId, CancellationToken ct)
    {
        var body = $"""
            <SetPreset xmlns="http://www.onvif.org/ver20/ptz/wsdl">
              <ProfileToken>{profileToken}</ProfileToken>
              <PresetToken>{presetId}</PresetToken>
              <PresetName>vyzio_home</PresetName>
            </SetPreset>
            """;
        return SendCommandAsync(camera, OnvifService.Ptz, body, ct);
    }

    public Task GotoPresetAsync(Camera camera, string profileToken, int presetId, CancellationToken ct)
    {
        var body = $"""
            <GotoPreset xmlns="http://www.onvif.org/ver20/ptz/wsdl">
              <ProfileToken>{profileToken}</ProfileToken>
              <PresetToken>{presetId}</PresetToken>
              <Speed>
                <PanTilt x="1.0" y="1.0" xmlns="http://www.onvif.org/ver10/schema"/>
              </Speed>
            </GotoPreset>
            """;
        return SendCommandAsync(camera, OnvifService.Ptz, body, ct);
    }

    // Returns the VideoSourceConfiguration token of the first media profile — required by the
    // Imaging service (ADR-27) to scope GetImagingSettings/SetImagingSettings to a video source.
    public async Task<string> GetVideoSourceTokenAsync(Camera camera, CancellationToken ct)
    {
        const string body = "<GetProfiles xmlns=\"http://www.onvif.org/ver10/media/wsdl\"/>";
        var xml = await PostSoapAsync(camera, OnvifService.Media, body, ct,
            soapAction: "http://www.onvif.org/ver10/media/wsdl/GetProfiles", throwOnFailure: true);

        XDocument doc;
        try { doc = XDocument.Parse(xml!); }
        catch (Exception ex) { throw new CameraCommandRefusedException($"ONVIF Media GetProfiles from {camera.Host}: unreadable answer ({ex.Message})", ex); }

        // SourceToken is a child element of VideoSourceConfiguration (tt:SourceToken), not an
        // attribute — the "token" attribute on VideoSourceConfiguration is its own config token.
        var token = doc.Descendants()
            .FirstOrDefault(e => e.Name.LocalName == "VideoSourceConfiguration")
            ?.Elements().FirstOrDefault(e => e.Name.LocalName == "SourceToken")?.Value;

        if (string.IsNullOrWhiteSpace(token))
            throw new CameraCommandRefusedException($"ONVIF Media on {camera.Host}: no usable VideoSourceConfiguration");

        return token;
    }

    // Throws a CameraCommandException on failure: this capability's probe must say why (ADR-27).
    public async Task<CameraImageSettings?> GetImagingSettingsAsync(Camera camera, string videoSourceToken, CancellationToken ct)
    {
        var body = $"""
            <GetImagingSettings xmlns="http://www.onvif.org/ver20/imaging/wsdl">
              <VideoSourceToken>{videoSourceToken}</VideoSourceToken>
            </GetImagingSettings>
            """;
        var xml = await PostSoapAsync(camera, OnvifService.Imaging, body, ct,
            soapAction: "http://www.onvif.org/ver20/imaging/wsdl/GetImagingSettings", throwOnFailure: true);

        try
        {
            var doc = XDocument.Parse(xml!);
            int Read(string localName) =>
                int.TryParse(doc.Descendants().FirstOrDefault(e => e.Name.LocalName == localName)?.Value,
                    NumberStyles.Float, CultureInfo.InvariantCulture, out var v) ? Math.Clamp(v, 0, 100) : 0;

            var irCutRaw = doc.Descendants().FirstOrDefault(e => e.Name.LocalName == "IrCutFilter")?.Value;
            var irCut = irCutRaw switch
            {
                "ON" => IrCutMode.On,
                "OFF" => IrCutMode.Off,
                _ => IrCutMode.Auto,
            };

            return new CameraImageSettings(
                Read("Brightness"),
                Read("Contrast"),
                Read("ColorSaturation"),
                Read("Sharpness"),
                irCut);
        }
        catch (Exception ex) when (ex is not CameraCommandException)
        {
            throw new CameraCommandRefusedException($"ONVIF Imaging from {camera.Host}: unreadable answer ({ex.Message})", ex);
        }
    }

    // Fire-and-forget write (same rationale as PTZ commands: budget cameras are slow to
    // respond over HTTP but apply the setting on receipt).
    public Task SetImagingSettingsAsync(Camera camera, string videoSourceToken, CameraImageSettings settings, CancellationToken ct)
    {
        var irCut = settings.IrCutMode switch
        {
            IrCutMode.On => "ON",
            IrCutMode.Off => "OFF",
            _ => "AUTO",
        };
        var body = $"""
            <SetImagingSettings xmlns="http://www.onvif.org/ver20/imaging/wsdl">
              <VideoSourceToken>{videoSourceToken}</VideoSourceToken>
              <ImagingSettings>
                <Brightness xmlns="http://www.onvif.org/ver10/schema">{settings.Brightness}</Brightness>
                <Contrast xmlns="http://www.onvif.org/ver10/schema">{settings.Contrast}</Contrast>
                <ColorSaturation xmlns="http://www.onvif.org/ver10/schema">{settings.Saturation}</ColorSaturation>
                <Sharpness xmlns="http://www.onvif.org/ver10/schema">{settings.Sharpness}</Sharpness>
                <IrCutFilter xmlns="http://www.onvif.org/ver10/schema">{irCut}</IrCutFilter>
              </ImagingSettings>
              <ForcePersistence>true</ForcePersistence>
            </SetImagingSettings>
            """;
        return SendCommandAsync(camera, OnvifService.Imaging, body, ct,
            soapAction: "http://www.onvif.org/ver20/imaging/wsdl/SetImagingSettings");
    }

    // Returns the count of presets reported by the camera. Used at probe time to set SupportsNativePresets (ADR-25).
    // Returns 0 on error or empty list — both indicate no native preset support.
    public async Task<int> GetPresetsCountAsync(Camera camera, string profileToken, CancellationToken ct)
    {
        var body = $"""
            <GetPresets xmlns="http://www.onvif.org/ver20/ptz/wsdl">
              <ProfileToken>{profileToken}</ProfileToken>
            </GetPresets>
            """;
        var xml = await PostSoapAsync(camera, OnvifService.Ptz, body, ct);
        if (xml is null) return 0;
        try
        {
            var doc = XDocument.Parse(xml);
            return doc.Descendants().Count(e => e.Name.LocalName == "Preset");
        }
        catch { return 0; }
    }

    private async Task SendCommandAsync(
        Camera camera, OnvifService service, string soapBody, CancellationToken ct, string? soapAction = null, TimeSpan? wait = null)
    {
        var url = await ResolveUrlAsync(camera, service, ct);
        var envelope = EnvelopeFor(camera, soapBody);
        var http = httpClientFactory.CreateClient("onvif");

        var patience = wait ?? CommandTimeout;
        using var timeout = new CancellationTokenSource(patience, time);
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(ct, timeout.Token);

        HttpResponseMessage response;
        try
        {
            var request = new HttpRequestMessage(HttpMethod.Post, url) { Content = BuildContent(envelope, soapAction) };
            response = await http.SendAsync(request, HttpCompletionOption.ResponseContentRead, linked.Token);
        }
        // Only silence counts as done: a slow camera (V380) executes on receipt and answers seconds later (ADR-56).
        catch (OperationCanceledException) when (timeout.IsCancellationRequested && !ct.IsCancellationRequested)
        {
            logger.LogDebug("ONVIF {Service} command sent to {Host}, no answer within {Timeout}.", service, camera.Host, patience);
            return;
        }
        catch (HttpRequestException ex)
        {
            logger.LogWarning(ex, "ONVIF {Service} command to {Host} failed: {Error}.", service, camera.Host, ex.HttpRequestError);
            throw TransportFailure(service, url, ex);
        }

        using (response)
        {
            if (response.IsSuccessStatusCode) return;

            var faultText = await TryReadSoapFaultReasonAsync(response, ct);
            logger.LogWarning("ONVIF {Service} command refused ({Status}) by {Host}: {Fault}.",
                service, response.StatusCode, camera.Host, faultText ?? "no SOAP fault");
            throw new CameraCommandRefusedException(RefusalDetail(service, response, faultText));
        }
    }

    // A malformed answer is how a Tapo refuses PTZ in privacy mode (measured); a cut-off one reads as the network (ADR-56).
    private static CameraCommandException TransportFailure(OnvifService service, Uri url, HttpRequestException ex)
        => ex.HttpRequestError is HttpRequestError.InvalidResponse
            ? new CameraCommandRefusedException($"ONVIF {service} at {url}: malformed answer ({ex.HttpRequestError})", ex)
            : new CameraUnreachableException($"ONVIF {service} at {url}: {ex.HttpRequestError} ({ex.Message})", ex);

    private static string RefusalDetail(OnvifService service, HttpResponseMessage response, string? faultText)
        => $"ONVIF {service} {(int)response.StatusCode} {response.ReasonPhrase}" + (faultText is null ? string.Empty : $": {faultText}");

    private async Task<Uri> ResolveUrlAsync(Camera camera, OnvifService service, CancellationToken ct)
    {
        var endpoint = await endpointResolver.ResolveAsync(camera, ct)
            ?? throw new CameraUnreachableException($"No ONVIF service answered on {camera.Host}");
        return endpoint.UrlFor(service);
    }

    // A camera without an account is asked without one: a guessed credential locks accounts out (ADR-56).
    private static string EnvelopeFor(Camera camera, string soapBody)
        => string.IsNullOrWhiteSpace(camera.Username)
            ? OnvifEnvelope.Anonymous(soapBody)
            : OnvifEnvelope.Build(camera.Username, camera.Password ?? string.Empty, soapBody);

    private static StringContent BuildContent(string envelope, string? soapAction)
    {
        var content = new StringContent(envelope, Encoding.UTF8, "application/soap+xml");
        if (soapAction is not null)
            content.Headers.ContentType?.Parameters.Add(new System.Net.Http.Headers.NameValueHeaderValue("action", $"\"{soapAction}\""));
        return content;
    }

    // A query; soapAction because some stacks refuse its absence, throwOnFailure where the caller must say why (ADR-27/28).
    internal async Task<string?> PostSoapAsync(Camera camera, OnvifService service, string soapBody, CancellationToken ct,
        string? soapAction = null, bool throwOnFailure = false)
    {
        Uri url;
        try
        {
            url = await ResolveUrlAsync(camera, service, ct);
        }
        catch (CameraUnreachableException) when (!throwOnFailure)
        {
            return null;
        }

        var envelope = EnvelopeFor(camera, soapBody);
        var http = httpClientFactory.CreateClient("onvif");
        var request = new HttpRequestMessage(HttpMethod.Post, url) { Content = BuildContent(envelope, soapAction) };

        try
        {
            using var response = await http.SendAsync(request, HttpCompletionOption.ResponseContentRead, ct);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("ONVIF {Service} call failed ({Status}) for {Host}.", service, response.StatusCode, camera.Host);
                if (throwOnFailure)
                {
                    var faultText = await TryReadSoapFaultReasonAsync(response, ct);
                    throw new CameraCommandRefusedException(RefusalDetail(service, response, faultText));
                }
                return null;
            }
            return await response.Content.ReadAsStringAsync(ct);
        }
        catch (CameraCommandException) { throw; }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "ONVIF {Service} call error for {Host}.", service, camera.Host);
            if (throwOnFailure)
                throw ex is HttpRequestException transport
                    ? TransportFailure(service, url, transport)
                    : new CameraUnreachableException($"ONVIF {service} at {url}: {ex.GetType().Name} ({ex.Message})", ex);
            return null;
        }
    }

    private static async Task<string?> TryReadSoapFaultReasonAsync(HttpResponseMessage response, CancellationToken ct)
    {
        try
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            if (string.IsNullOrWhiteSpace(body)) return null;
            var doc = XDocument.Parse(body);
            var text = doc.Descendants().FirstOrDefault(e => e.Name.LocalName == "Text")?.Value;
            return string.IsNullOrWhiteSpace(text) ? null : text;
        }
        catch { return null; }
    }
}
