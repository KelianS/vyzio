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

    public async Task<string> GetFirstProfileTokenAsync(Camera camera, CancellationToken ct)
    {
        var body = "<GetProfiles xmlns=\"http://www.onvif.org/ver10/media/wsdl\"/>";
        var response = await PostOnvifAsync(camera, "media_service", body, ct);
        if (response is null) return "profile1";

        try
        {
            var doc = XDocument.Parse(response);
            XNamespace trt = "http://www.onvif.org/ver10/media/wsdl";
            var token = doc.Descendants(trt + "Profiles")
                           .FirstOrDefault()
                           ?.Attribute("token")?.Value;
            return token ?? "profile1";
        }
        catch
        {
            return "profile1";
        }
    }

    public async Task ContinuousMoveAsync(Camera camera, string profileToken, float pan, float tilt, CancellationToken ct)
    {
        var body = $"""
            <ContinuousMove xmlns="http://www.onvif.org/ver20/ptz/wsdl">
              <ProfileToken>{profileToken}</ProfileToken>
              <Velocity>
                <PanTilt x="{pan:F2}" y="{tilt:F2}" xmlns="http://www.onvif.org/ver10/schema"/>
              </Velocity>
            </ContinuousMove>
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

        using var http = httpClientFactory.CreateClient("onvif");
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
