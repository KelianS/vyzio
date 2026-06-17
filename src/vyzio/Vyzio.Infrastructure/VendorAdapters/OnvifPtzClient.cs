using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Xml.Linq;
using Microsoft.Extensions.Logging;
using Vyzio.Core.Entities;

namespace Vyzio.Infrastructure.VendorAdapters;

// Shared ONVIF PTZ client (raw SOAP over HTTP).
// Covers ONVIF-compliant cameras: V380 Pro, Hikvision, Dahua, Reolink, Axis and any PTZ with ONVIF.
// Authentication: WS-UsernameToken with PasswordDigest (SHA-1).
internal sealed class OnvifPtzClient(IHttpClientFactory httpClientFactory, ILogger<OnvifPtzClient> logger)
{
    private const int DefaultOnvifPort = 8899;

    // Profile tokens are stable for the lifetime of a camera — cache per camera ID to avoid
    // a GetProfiles round-trip before every PTZ command (which was the main source of step overshoot).
    private readonly System.Collections.Concurrent.ConcurrentDictionary<string, string> _profileCache = new();

    public async Task<string> GetFirstProfileTokenAsync(Camera camera, CancellationToken ct)
    {
        if (_profileCache.TryGetValue(camera.Id, out var cached))
            return cached;

        var body = "<GetProfiles xmlns=\"http://www.onvif.org/ver10/media/wsdl\"/>";
        var response = await PostOnvifAsync(camera, "media_service", body, ct);

        string token = "profile1";
        if (response is not null)
        {
            try
            {
                var doc = XDocument.Parse(response);
                XNamespace trt = "http://www.onvif.org/ver10/media/wsdl";
                token = doc.Descendants(trt + "Profiles")
                           .FirstOrDefault()
                           ?.Attribute("token")?.Value ?? "profile1";
            }
            catch { }
        }

        _profileCache[camera.Id] = token;
        return token;
    }

    public async Task ContinuousMoveAsync(Camera camera, string profileToken, float pan, float tilt, CancellationToken ct)
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
        await PostOnvifAsync(camera, "ptz_service", body, ct);
    }

    // Returns (pan, tilt) in ONVIF normalized space [-1, 1], or null if camera doesn't report position.
    public async Task<(float Pan, float Tilt)?> GetPtzPositionAsync(Camera camera, CancellationToken ct)
    {
        var token = await GetFirstProfileTokenAsync(camera, ct);
        var body = $"""
            <GetStatus xmlns="http://www.onvif.org/ver20/ptz/wsdl">
              <ProfileToken>{token}</ProfileToken>
            </GetStatus>
            """;
        var response = await PostOnvifAsync(camera, "ptz_service", body, ct);
        if (response is null) return null;

        try
        {
            var doc = XDocument.Parse(response);
            XNamespace tt = "http://www.onvif.org/ver10/schema";
            var panTilt = doc.Descendants(tt + "PanTilt").FirstOrDefault();
            if (panTilt is null) return null;

            var xAttr = panTilt.Attribute("x")?.Value;
            var yAttr = panTilt.Attribute("y")?.Value;
            if (xAttr is null || yAttr is null) return null;

            if (!float.TryParse(xAttr, NumberStyles.Float, CultureInfo.InvariantCulture, out var pan)) return null;
            if (!float.TryParse(yAttr, NumberStyles.Float, CultureInfo.InvariantCulture, out var tilt)) return null;

            return (pan, tilt);
        }
        catch { return null; }
    }

    public async Task RelativeMoveAsync(Camera camera, string profileToken, float pan, float tilt, CancellationToken ct)
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
        await PostOnvifAsync(camera, "ptz_service", body, ct);
    }

    public async Task StopAsync(Camera camera, string profileToken, CancellationToken ct)
    {
        var body = $"""
            <Stop xmlns="http://www.onvif.org/ver20/ptz/wsdl">
              <ProfileToken>{profileToken}</ProfileToken>
              <PanTilt>true</PanTilt>
              <Zoom>true</Zoom>
            </Stop>
            """;
        await PostOnvifAsync(camera, "ptz_service", body, ct);
    }

    public async Task SetPresetAsync(Camera camera, string profileToken, int presetId, CancellationToken ct)
    {
        var body = $"""
            <SetPreset xmlns="http://www.onvif.org/ver20/ptz/wsdl">
              <ProfileToken>{profileToken}</ProfileToken>
              <PresetToken>{presetId}</PresetToken>
              <PresetName>vyzio_home</PresetName>
            </SetPreset>
            """;
        await PostOnvifAsync(camera, "ptz_service", body, ct);
    }

    public async Task GotoPresetAsync(Camera camera, string profileToken, int presetId, CancellationToken ct)
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
        await PostOnvifAsync(camera, "ptz_service", body, ct);
    }

    private async Task<string?> PostOnvifAsync(Camera camera, string service, string soapBody, CancellationToken ct)
    {
        var port = camera.Port is 8899 or 0 ? DefaultOnvifPort : DefaultOnvifPort;
        var url = $"http://{camera.Host}:{port}/onvif/{service}";
        var envelope = BuildEnvelope(camera.Username ?? "admin", camera.Password ?? string.Empty, soapBody);

        var http = httpClientFactory.CreateClient("onvif");  // factory manages lifetime — don't dispose
        using var content = new StringContent(envelope, Encoding.UTF8, "application/soap+xml");

        try
        {
            var response = await http.PostAsync(url, content, ct);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("ONVIF {Service} call failed ({Status}) for {Host}.", service, response.StatusCode, camera.Host);
                return null;
            }
            return await response.Content.ReadAsStringAsync(ct);
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
