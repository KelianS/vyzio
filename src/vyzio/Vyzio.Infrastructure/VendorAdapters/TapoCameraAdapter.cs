using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.VendorAdapters;

// Tapo KLAP local API adapter (TP-Link cameras).
// Protocol: Key-based Local Authentication Protocol (community-documented reverse engineering).
// Reference: https://github.com/python-kasa/python-kasa
// When privacy mode is active: lens mask is engaged + LED turns off (physical signal).
public sealed class TapoCameraAdapter(IHttpClientFactory httpClientFactory, ILogger<TapoCameraAdapter> logger)
    : IVendorCameraAdapter
{
    public string VendorFamily => "tplink_tapo";

    public Task<bool> SupportsPrivacyModeAsync(Camera camera, CancellationToken ct = default)
        => Task.FromResult(true);

    public async Task SetPrivacyModeAsync(Camera camera, bool active, CancellationToken ct = default)
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

    private async Task<KlapSession?> AuthenticateAsync(Camera camera, CancellationToken ct)
    {
        var http = httpClientFactory.CreateClient("tapo");
        var baseUrl = $"http://{camera.Host}";
        var username = camera.Username ?? "admin";
        var password = camera.Password ?? string.Empty;

        var localSeed = RandomNumberGenerator.GetBytes(16);
        var credHash = ComputeCredentialHash(username, password);

        // Handshake 1: send local seed, receive server seed + server hash
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

        // Verify the server hash to authenticate the device
        var expectedServerHash = SHA256.HashData([.. serverSeed, .. localSeed, .. credHash]);
        if (!expectedServerHash.AsSpan().SequenceEqual(serverHash))
        {
            logger.LogWarning("Tapo KLAP server hash mismatch on {Host} — wrong credentials or incompatible firmware.", camera.Host);
            return null;
        }

        // Handshake 2: send client hash to authenticate ourselves
        var clientHash = SHA256.HashData([.. localSeed, .. serverSeed, .. credHash]);
        using var hs2Content = new ByteArrayContent(clientHash);
        var hs2Response = await http.PostAsync($"{baseUrl}/app/handshake2", hs2Content, ct);
        if (!hs2Response.IsSuccessStatusCode)
        {
            logger.LogWarning("Tapo KLAP handshake2 failed ({Status}) on {Host}.", hs2Response.StatusCode, camera.Host);
            return null;
        }

        // Extract session cookie
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

    // Credential hash as per KLAP spec: inner SHA256 is hex-encoded before outer SHA256
    private static byte[] ComputeCredentialHash(string username, string password)
    {
        var unHex = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(username))).ToLowerInvariant();
        var pwHex = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(password))).ToLowerInvariant();
        return SHA256.HashData(Encoding.UTF8.GetBytes(unHex + pwHex));
    }

    // Key derivation with KLAP-specific labels ("lsk" and "iv")
    private static (byte[] key, byte[] iv) DeriveKeyAndIv(byte[] localSeed, byte[] serverSeed, byte[] credHash)
    {
        var payload = (byte[])[.. localSeed, .. serverSeed, .. credHash];
        var key = SHA256.HashData([.. "lsk"u8.ToArray(), .. payload])[..16];
        var iv = SHA256.HashData([.. "iv"u8.ToArray(), .. payload])[..12];
        return (key, iv);
    }

    // AES-128-GCM encryption per KLAP: IV last 4 bytes XORed with seq (big-endian), AAD = seq bytes
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

        // Payload: seq (4 bytes) + ciphertext + tag (16 bytes)
        return ([.. seqBytes, .. ciphertext, .. tag], seq);
    }

    private sealed record KlapSession(byte[] Key, byte[] Iv, string Cookie, int Seq);
}
