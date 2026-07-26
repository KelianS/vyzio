using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Xml.Linq;
using Microsoft.Extensions.Logging;
using Vyzio.Core.Entities;

namespace Vyzio.Infrastructure.VendorAdapters;

// Thrown by PostSoapAsync(throwOnFailure: true) — carries the real HTTP status / SOAP fault
// reason so it can surface as CameraCapabilityBinding.LastError instead of a generic message.
public sealed class OnvifCallException(string message, Exception? inner = null) : Exception(message, inner);

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
internal sealed class OnvifClient(IHttpClientFactory httpClientFactory, ILogger<OnvifClient> logger)
{
    private const int DefaultOnvifPort = 8899;

    // Returns device identification info from ONVIF GetDeviceInformation.
    // The SerialNumber field encodes the V380 device ID in bytes 2-5 as uint32 big-endian.
    public async Task<OnvifDeviceInfo?> GetDeviceInformationAsync(Camera camera, CancellationToken ct)
    {
        const string body = "<GetDeviceInformation xmlns=\"http://www.onvif.org/ver10/device/wsdl\"/>";
        var xml = await PostSoapAsync(camera, "device_service", body, ct);
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
        var xml = await PostSoapAsync(camera, "media_service", body, ct);

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
        var xml = await PostSoapAsync(camera, "media_service", body, ct,
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
        var xml = await PostSoapAsync(camera, "media_service", body, ct,
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
        return PostSoapAsync(camera, "ptz_service", body, ct);
    }

    // Returns (pan, tilt) in ONVIF normalized space [-1, 1], or null if unsupported.
    public async Task<(float Pan, float Tilt)?> GetStatusAsync(Camera camera, string profileToken, CancellationToken ct)
    {
        var body = $"""
            <GetStatus xmlns="http://www.onvif.org/ver20/ptz/wsdl">
              <ProfileToken>{profileToken}</ProfileToken>
            </GetStatus>
            """;
        var xml = await PostSoapAsync(camera, "ptz_service", body, ct);
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
        return SendCommandAsync(camera, "ptz_service", body, ct);
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
        return SendCommandAsync(camera, "ptz_service", body, ct);
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
        return SendCommandAsync(camera, "ptz_service", body, ct);
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
        return SendCommandAsync(camera, "ptz_service", body, ct);
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
        return SendCommandAsync(camera, "ptz_service", body, ct);
    }

    // Returns the VideoSourceConfiguration token of the first media profile — required by the
    // Imaging service (ADR-27) to scope GetImagingSettings/SetImagingSettings to a video source.
    public async Task<string> GetVideoSourceTokenAsync(Camera camera, CancellationToken ct)
    {
        const string body = "<GetProfiles xmlns=\"http://www.onvif.org/ver10/media/wsdl\"/>";
        var xml = await PostSoapAsync(camera, "media_service", body, ct,
            soapAction: "http://www.onvif.org/ver10/media/wsdl/GetProfiles", throwOnFailure: true);

        XDocument doc;
        try { doc = XDocument.Parse(xml!); }
        catch (Exception ex) { throw new OnvifCallException($"Réponse ONVIF media_service illisible pour {camera.Host} : {ex.Message}", ex); }

        // SourceToken is a child element of VideoSourceConfiguration (tt:SourceToken), not an
        // attribute — the "token" attribute on VideoSourceConfiguration is its own config token.
        var token = doc.Descendants()
            .FirstOrDefault(e => e.Name.LocalName == "VideoSourceConfiguration")
            ?.Elements().FirstOrDefault(e => e.Name.LocalName == "SourceToken")?.Value;

        if (string.IsNullOrWhiteSpace(token))
            throw new OnvifCallException($"La caméra {camera.Host} n'expose pas de VideoSourceConfiguration ONVIF exploitable (profil vide ou non conforme).");

        return token;
    }

    // Returns current image settings via ONVIF Imaging service. Throws OnvifCallException with a
    // real diagnostic on failure — this capability's probe must surface why, unlike PTZ/media
    // calls elsewhere in this client which tolerate silent failure with built-in fallbacks.
    public async Task<CameraImageSettings?> GetImagingSettingsAsync(Camera camera, string videoSourceToken, CancellationToken ct)
    {
        var body = $"""
            <GetImagingSettings xmlns="http://www.onvif.org/ver20/imaging/wsdl">
              <VideoSourceToken>{videoSourceToken}</VideoSourceToken>
            </GetImagingSettings>
            """;
        var xml = await PostSoapAsync(camera, "imaging_service", body, ct,
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
        catch (Exception ex) when (ex is not OnvifCallException)
        {
            throw new OnvifCallException($"Réponse ONVIF Imaging illisible pour {camera.Host} : {ex.Message}", ex);
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
        return SendCommandAsync(camera, "imaging_service", body, ct,
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
        var xml = await PostSoapAsync(camera, "ptz_service", body, ct);
        if (xml is null) return 0;
        try
        {
            var doc = XDocument.Parse(xml);
            return doc.Descendants().Count(e => e.Name.LocalName == "Preset");
        }
        catch { return 0; }
    }

    // Fire-and-forget ONVIF command: sends the request and returns as soon as headers arrive
    // (or after 500ms timeout). Budget cameras (V380) take 2-3s to respond but execute the
    // command on TCP receipt — we don't need to wait for their HTTP response.
    private async Task SendCommandAsync(Camera camera, string service, string soapBody, CancellationToken ct, string? soapAction = null)
    {
        var url = $"http://{camera.Host}:{DefaultOnvifPort}/onvif/{service}";
        var envelope = BuildEnvelope(camera.Username ?? "admin", camera.Password ?? string.Empty, soapBody);
        var http = httpClientFactory.CreateClient("onvif");

        using var timeout = new CancellationTokenSource(TimeSpan.FromMilliseconds(500));
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(ct, timeout.Token);
        try
        {
            var content = new StringContent(envelope, Encoding.UTF8, "application/soap+xml");
            if (soapAction is not null)
                content.Headers.ContentType?.Parameters.Add(new System.Net.Http.Headers.NameValueHeaderValue("action", $"\"{soapAction}\""));
            var request = new HttpRequestMessage(HttpMethod.Post, url) { Content = content };
            using var response = await http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, linked.Token);
        }
        catch (Exception ex)
        {
            logger.LogDebug("ONVIF {Service} command sent to {Host} (response not awaited: {Msg}).", service, camera.Host, ex.Message);
        }
    }

    // readBody=false: ResponseHeadersRead — returns as soon as status is known, without reading body.
    // Use for commands (Move, RelativeMove, Preset) where we only need the camera to receive the request.
    // Use readBody=true (default) for queries (GetProfiles, GetDeviceInformation) that need the response XML.
    // soapAction: SOAP 1.2 action URI (e.g. ".../imaging/wsdl/GetImagingSettings") — some ONVIF stacks
    // reject requests with a generic BadRequest when it's missing from the Content-Type "action" param.
    // throwOnFailure: throws OnvifCallException with the real reason (HTTP status + SOAP fault text if
    // present) instead of silently returning null — used where the caller needs to surface a real
    // diagnostic (ADR-27/28 probe paths), not the many callers that treat "no answer" as "unsupported".
    internal async Task<string?> PostSoapAsync(Camera camera, string service, string soapBody, CancellationToken ct,
        bool readBody = true, string? soapAction = null, bool throwOnFailure = false)
    {
        var url = $"http://{camera.Host}:{DefaultOnvifPort}/onvif/{service}";
        var envelope = BuildEnvelope(camera.Username ?? "admin", camera.Password ?? string.Empty, soapBody);

        var http = httpClientFactory.CreateClient("onvif");
        var content = new StringContent(envelope, Encoding.UTF8, "application/soap+xml");
        if (soapAction is not null)
            content.Headers.ContentType?.Parameters.Add(new System.Net.Http.Headers.NameValueHeaderValue("action", $"\"{soapAction}\""));
        var request = new HttpRequestMessage(HttpMethod.Post, url) { Content = content };
        var completion = readBody ? HttpCompletionOption.ResponseContentRead : HttpCompletionOption.ResponseHeadersRead;

        try
        {
            using var response = await http.SendAsync(request, completion, ct);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("ONVIF {Service} call failed ({Status}) for {Host}.", service, response.StatusCode, camera.Host);
                if (throwOnFailure)
                {
                    var faultText = await TryReadSoapFaultReasonAsync(response, ct);
                    throw new OnvifCallException(faultText is not null
                        ? $"La caméra a refusé la requête ONVIF {service} ({(int)response.StatusCode} {response.ReasonPhrase}) : {faultText}"
                        : $"La caméra a refusé la requête ONVIF {service} ({(int)response.StatusCode} {response.ReasonPhrase}).");
                }
                return null;
            }
            return readBody ? await response.Content.ReadAsStringAsync(ct) : string.Empty;
        }
        catch (OnvifCallException) { throw; }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "ONVIF {Service} call error for {Host}.", service, camera.Host);
            if (throwOnFailure)
                throw new OnvifCallException($"Impossible de joindre le service ONVIF {service} sur {camera.Host}:{DefaultOnvifPort} ({ex.Message}).", ex);
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

    private static string BuildEnvelope(string username, string password, string body)
    {
        var nonce = RandomNumberGenerator.GetBytes(16);
        var created = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ");
        var createdBytes = Encoding.UTF8.GetBytes(created);
        var passwordBytes = Encoding.UTF8.GetBytes(password);
        var digest = Convert.ToBase64String(SHA1.HashData([.. nonce, .. createdBytes, .. passwordBytes]));
        var nonce64 = Convert.ToBase64String(nonce);

        return $"""
            <?xml version="1.0" encoding="utf-8"?>
            <s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
                        xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd"
                        xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-utility-1.0.xsd">
              <s:Header>
                <wsse:Security>
                  <wsse:UsernameToken>
                    <wsse:Username>{username}</wsse:Username>
                    <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">{digest}</wsse:Password>
                    <wsse:Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">{nonce64}</wsse:Nonce>
                    <wsu:Created>{created}</wsu:Created>
                  </wsse:UsernameToken>
                </wsse:Security>
              </s:Header>
              <s:Body>
                {body}
              </s:Body>
            </s:Envelope>
            """;
    }
}
