using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Xml.Linq;
using Microsoft.Extensions.Logging;
using Vyzio.Core.Entities;

namespace Vyzio.Infrastructure.VendorAdapters;

public sealed record OnvifDeviceInfo(
    string? Manufacturer,
    string? Model,
    string? FirmwareVersion,
    string? SerialNumber);

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

    // Fire-and-forget ONVIF command: sends the request and returns as soon as headers arrive
    // (or after 500ms timeout). Budget cameras (V380) take 2-3s to respond but execute the
    // command on TCP receipt — we don't need to wait for their HTTP response.
    private async Task SendCommandAsync(Camera camera, string service, string soapBody, CancellationToken ct)
    {
        var url = $"http://{camera.Host}:{DefaultOnvifPort}/onvif/{service}";
        var envelope = BuildEnvelope(camera.Username ?? "admin", camera.Password ?? string.Empty, soapBody);
        var http = httpClientFactory.CreateClient("onvif");

        using var timeout = new CancellationTokenSource(TimeSpan.FromMilliseconds(500));
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(ct, timeout.Token);
        try
        {
            var request = new HttpRequestMessage(HttpMethod.Post, url)
            {
                Content = new StringContent(envelope, Encoding.UTF8, "application/soap+xml")
            };
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
    internal async Task<string?> PostSoapAsync(Camera camera, string service, string soapBody, CancellationToken ct,
        bool readBody = true)
    {
        var url = $"http://{camera.Host}:{DefaultOnvifPort}/onvif/{service}";
        var envelope = BuildEnvelope(camera.Username ?? "admin", camera.Password ?? string.Empty, soapBody);

        var http = httpClientFactory.CreateClient("onvif");
        var request = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = new StringContent(envelope, Encoding.UTF8, "application/soap+xml")
        };
        var completion = readBody ? HttpCompletionOption.ResponseContentRead : HttpCompletionOption.ResponseHeadersRead;

        try
        {
            using var response = await http.SendAsync(request, completion, ct);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("ONVIF {Service} call failed ({Status}) for {Host}.", service, response.StatusCode, camera.Host);
                return null;
            }
            return readBody ? await response.Content.ReadAsStringAsync(ct) : string.Empty;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "ONVIF {Service} call error for {Host}.", service, camera.Host);
            return null;
        }
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
