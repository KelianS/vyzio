using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.CapabilityProviders;

// Tapo KLAP local API — implements BOTH IPrivacyCapabilityProvider (set_lens_mask, proven in
// production via TapoCameraAdapter) AND IPtzCapabilityProvider (motorMove, NEW — see ADR-22).
//
// This is the concrete example that motivated the capability/protocol split: Tapo pan-tilt
// cameras (C200, C210, C225...) support PTZ over the exact same KLAP transport already used
// for privacy mode, but the old per-vendor adapter only exposed the capability it was
// originally written for. The transport (handshake, AES-128-GCM) is unchanged from
// TapoCameraAdapter — only the PTZ command payload is new and needs hardware validation.
public sealed class TapoKlapProvider(IHttpClientFactory httpClientFactory, ILogger<TapoKlapProvider> logger)
    : IPrivacyCapabilityProvider, IPtzCapabilityProvider
{
    CapabilityProtocol IPrivacyCapabilityProvider.Protocol => CapabilityProtocol.TapoKlap;
    CapabilityProtocol IPtzCapabilityProvider.Protocol => CapabilityProtocol.TapoKlap;

    public async Task<bool> ProbeAsync(Camera camera, CameraCapabilityBinding binding, CancellationToken ct = default)
        => await AuthenticateAsync(camera, ct) is not null;

    public async Task SetPrivacyModeAsync(Camera camera, CameraCapabilityBinding binding, bool active, CancellationToken ct = default)
    {
        var session = await AuthenticateAsync(camera, ct)
            ?? throw new InvalidOperationException($"KLAP authentication failed for camera {camera.DisplayName} ({camera.Host}).");

        var command = new
        {
            method = "set_device_info",
            @params = new { lens_mask_info = new { enabled = active ? "on" : "off" } }
        };

        await SendCommandAsync(camera.Host, session, JsonSerializer.Serialize(command), ct);
        logger.LogInformation("Tapo privacy mode set to {Active} on {Host} (LED should be {LedState}).",
            active, camera.Host, active ? "off" : "on");
    }

    // NEW — continuous pan/tilt via KLAP motorMove. Direction/speed mapping is a first
    // implementation derived from community KLAP documentation (python-kasa); the exact
    // payload shape should be confirmed against real Tapo pan-tilt hardware before this
    // provider is offered as a verified preset binding (see ADR-22 migration/backfill notes —
    // Ptz/TapoKlap is never auto-activated for existing cameras, probe-gated only).
    public async Task PtzMoveAsync(Camera camera, CameraCapabilityBinding binding, PtzDirection direction, int speed, CancellationToken ct = default)
    {
        var session = await AuthenticateAsync(camera, ct)
            ?? throw new InvalidOperationException($"KLAP authentication failed for camera {camera.DisplayName} ({camera.Host}).");

        var (x, y) = DirectionToVelocity(direction, speed);
        var command = new
        {
            method = "motorMove",
            @params = new { x, y }
        };

        await SendCommandAsync(camera.Host, session, JsonSerializer.Serialize(command), ct);
    }

    public async Task PtzStopAsync(Camera camera, CameraCapabilityBinding binding, CancellationToken ct = default)
    {
        var session = await AuthenticateAsync(camera, ct)
            ?? throw new InvalidOperationException($"KLAP authentication failed for camera {camera.DisplayName} ({camera.Host}).");

        var command = new { method = "motorMove", @params = new { x = 0, y = 0 } };
        await SendCommandAsync(camera.Host, session, JsonSerializer.Serialize(command), ct);
    }

    // Tapo consumer firmware does not expose ONVIF-style presets over KLAP — parking relies
    // on PtzParkingPrivacyProvider's mechanical-limit move, not a saved preset position.
    public Task PtzGoToPresetAsync(Camera camera, CameraCapabilityBinding binding, int presetId, CancellationToken ct = default)
        => Task.CompletedTask;

    public Task PtzSavePresetAsync(Camera camera, CameraCapabilityBinding binding, int presetId, CancellationToken ct = default)
        => Task.CompletedTask;

    private static (int x, int y) DirectionToVelocity(PtzDirection direction, int speed)
    {
        var s = Math.Clamp(speed, 1, 100);
        return direction switch
        {
            PtzDirection.Up        => (0,  s),
            PtzDirection.Down      => (0, -s),
            PtzDirection.Left      => (-s, 0),
            PtzDirection.Right     => (s,  0),
            PtzDirection.UpLeft    => (-s,  s),
            PtzDirection.UpRight   => (s,   s),
            PtzDirection.DownLeft  => (-s, -s),
            PtzDirection.DownRight => (s,  -s),
            _                      => (0,  0),
        };
    }

    private async Task<KlapSession?> AuthenticateAsync(Camera camera, CancellationToken ct)
    {
        var http = httpClientFactory.CreateClient("tapo");
        var baseUrl = $"http://{camera.Host}";
        var username = camera.Username ?? "admin";
        var password = camera.Password ?? string.Empty;

        var localSeed = RandomNumberGenerator.GetBytes(16);
        var credHash = ComputeCredentialHash(username, password);

        using var hs1Content = new ByteArrayContent(localSeed);
        var hs1Response = await http.PostAsync($"{baseUrl}/app/handshake1", hs1Content, ct);
        if (!hs1Response.IsSuccessStatusCode)
        {
            logger.LogWarning("Tapo KLAP handshake1 failed ({Status}) on {Host}.", hs1Response.StatusCode, camera.Host);
            return null;
        }

        var hs1Body = await hs1Response.Content.ReadAsByteArrayAsync(ct);
        if (hs1Body.Length < 48)
        {
            logger.LogWarning("Tapo KLAP handshake1 response too short ({Len}) on {Host}.", hs1Body.Length, camera.Host);
            return null;
        }

        var serverSeed = hs1Body[..16];
        var serverHash = hs1Body[16..48];

        var expectedServerHash = SHA256.HashData([.. serverSeed, .. localSeed, .. credHash]);
        if (!expectedServerHash.AsSpan().SequenceEqual(serverHash))
        {
            logger.LogWarning("Tapo KLAP server hash mismatch on {Host} — wrong credentials or incompatible firmware.", camera.Host);
            return null;
        }

        var clientHash = SHA256.HashData([.. localSeed, .. serverSeed, .. credHash]);
        using var hs2Content = new ByteArrayContent(clientHash);
        var hs2Response = await http.PostAsync($"{baseUrl}/app/handshake2", hs2Content, ct);
        if (!hs2Response.IsSuccessStatusCode)
        {
            logger.LogWarning("Tapo KLAP handshake2 failed ({Status}) on {Host}.", hs2Response.StatusCode, camera.Host);
            return null;
        }

        var cookie = hs2Response.Headers.TryGetValues("Set-Cookie", out var cookies)
            ? cookies.FirstOrDefault(c => c.StartsWith("TP_SESSIONID=", StringComparison.OrdinalIgnoreCase))
            : null;

        if (cookie is null)
        {
            logger.LogWarning("Tapo KLAP session cookie missing after handshake2 on {Host}.", camera.Host);
            return null;
        }

        var (key, iv) = DeriveKeyAndIv(localSeed, serverSeed, credHash);
        return new KlapSession(key, iv, cookie, Seq: 1);
    }

    private async Task SendCommandAsync(string host, KlapSession session, string commandJson, CancellationToken ct)
    {
        var http = httpClientFactory.CreateClient("tapo");

        var (payload, seq) = Encrypt(session, commandJson);
        using var content = new ByteArrayContent(payload);
        content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/octet-stream");

        var request = new HttpRequestMessage(HttpMethod.Post, $"http://{host}/app?seq={seq}");
        request.Content = content;
        request.Headers.Add("Cookie", session.Cookie);

        var response = await http.SendAsync(request, ct);
        response.EnsureSuccessStatusCode();
    }

    private static byte[] ComputeCredentialHash(string username, string password)
    {
        var unHex = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(username))).ToLowerInvariant();
        var pwHex = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(password))).ToLowerInvariant();
        return SHA256.HashData(Encoding.UTF8.GetBytes(unHex + pwHex));
    }

    private static (byte[] key, byte[] iv) DeriveKeyAndIv(byte[] localSeed, byte[] serverSeed, byte[] credHash)
    {
        var payload = (byte[])[.. localSeed, .. serverSeed, .. credHash];
        var key = SHA256.HashData([.. "lsk"u8.ToArray(), .. payload])[..16];
        var iv = SHA256.HashData([.. "iv"u8.ToArray(), .. payload])[..12];
        return (key, iv);
    }

    private static (byte[] payload, int seq) Encrypt(KlapSession session, string plaintext)
    {
        var seq = session.Seq;
        var seqBytes = new byte[4];
        seqBytes[0] = (byte)(seq >> 24);
        seqBytes[1] = (byte)(seq >> 16);
        seqBytes[2] = (byte)(seq >> 8);
        seqBytes[3] = (byte)seq;

        var iv = (byte[])[.. session.Iv];
        iv[8] ^= seqBytes[0];
        iv[9] ^= seqBytes[1];
        iv[10] ^= seqBytes[2];
        iv[11] ^= seqBytes[3];

        var plaintextBytes = Encoding.UTF8.GetBytes(plaintext);
        var ciphertext = new byte[plaintextBytes.Length];
        var tag = new byte[16];

        using var aes = new AesGcm(session.Key, 16);
        aes.Encrypt(iv, plaintextBytes, ciphertext, tag, seqBytes);

        return ([.. seqBytes, .. ciphertext, .. tag], seq);
    }

    private sealed record KlapSession(byte[] Key, byte[] Iv, string Cookie, int Seq);
}
