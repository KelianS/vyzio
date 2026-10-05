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
internal sealed class TapoKlapProvider(IHttpClientFactory httpClientFactory, PtzMoveRunner runner, ILogger<TapoKlapProvider> logger)
    : IPrivacyCapabilityProvider, IPtzCapabilityProvider
{
    SupportedProtocol IPrivacyCapabilityProvider.Protocol => SupportedProtocol.TapoKlap;
    SupportedProtocol IPtzCapabilityProvider.Protocol => SupportedProtocol.TapoKlap;

    // Estimate, unmeasured on Tapo pan-tilt hardware like the move itself (ADR-60).
    public TimeSpan FullRange => TimeSpan.FromSeconds(15);

    // No read of the lens cut is validated on hardware: the handshake is the protocol's, so the user confirms (ADR-66).
    Task<CapabilityProof> IPrivacyCapabilityProvider.ProveAsync(Camera camera, CameraCapabilityBinding binding, CancellationToken ct)
        => Task.FromResult(CapabilityProof.Unprovable());

    // No read of the motor is validated on hardware either (ADR-66).
    Task<CapabilityProof> IPtzCapabilityProvider.ProveAsync(Camera camera, CameraCapabilityBinding binding, CancellationToken ct)
        => Task.FromResult(CapabilityProof.Unprovable());

    public async Task SetPrivacyModeAsync(Camera camera, CameraCapabilityBinding binding, bool active, CancellationToken ct = default)
    {
        var session = await AuthenticateAsync(camera, ct)
            ?? throw new InvalidOperationException($"KLAP authentication failed for camera {camera.DisplayName} ({camera.Host}).");

        var command = new
        {
            method = "set_device_info",
            @params = new { lens_mask_info = new { enabled = active ? "on" : "off" } }
        };

        await SendCommandAsync(camera, session, JsonSerializer.Serialize(command), ct);
        logger.LogInformation("Tapo privacy mode set to {Active} on {Host} (LED should be {LedState}).",
            active, camera.Host, active ? "off" : "on");
    }

    // The KLAP handshake happens here, before the move, and its session carries every command of it (ADR-60).
    public async Task<IPtzMotion> OpenMotionAsync(Camera camera, CameraCapabilityBinding binding, CancellationToken ct = default)
        => new Motion(this, runner, camera, await AuthenticatePtzAsync(camera, ct));

    private async Task<KlapSession> AuthenticatePtzAsync(Camera camera, CancellationToken ct)
        => await AuthenticateAsync(camera, ct)
            ?? throw new InvalidOperationException($"KLAP authentication failed for camera {camera.DisplayName} ({camera.Host}).");

    private async Task SendMoveAsync(Camera camera, KlapSession session, (int X, int Y) velocity, CancellationToken ct)
    {
        var command = new { method = "motorMove", @params = new { x = velocity.X, y = velocity.Y } };
        await SendCommandAsync(camera, session, JsonSerializer.Serialize(command), ct);
    }

    private sealed class Motion(TapoKlapProvider provider, PtzMoveRunner runner, Camera camera, KlapSession session)
        : PtzContinuousMotion(runner, camera)
    {
        protected override Task MoveAsync(PtzDirection direction, int speed, CancellationToken ct)
            => provider.SendMoveAsync(Camera, session, DirectionToVelocity(direction, speed), ct);

        protected override Task StopMoveAsync(CancellationToken ct) => provider.SendMoveAsync(Camera, session, (0, 0), ct);
    }

    public Task<(float Pan, float Tilt)?> GetPtzPositionAsync(Camera camera, CameraCapabilityBinding binding, CancellationToken ct = default)
        => Task.FromResult<(float Pan, float Tilt)?>(null);

    // No presets over KLAP; a Tapo reaches its saved positions over ONVIF instead (ADR-56, ADR-57).
    public Task PtzGoToPresetAsync(Camera camera, CameraCapabilityBinding binding, int presetId, CancellationToken ct = default)
        => Task.CompletedTask;

    public Task PtzSavePresetAsync(Camera camera, CameraCapabilityBinding binding, int presetId, CancellationToken ct = default)
        => Task.CompletedTask;

    // Its probe never puts the camera on the native tier: a call is a wiring mistake, never an empty list (ADR-69 g).
    public Task<IReadOnlySet<int>> ReadPresetsAsync(Camera camera, CameraCapabilityBinding binding, CancellationToken ct = default)
        => throw new NotSupportedException($"{SupportedProtocol.TapoKlap} keeps no native presets to read.");

    // The direction mapping comes from community KLAP documentation, unconfirmed on Tapo pan-tilt hardware: probe-gated, never seeded (ADR-22).
    internal static (int x, int y) DirectionToVelocity(PtzDirection direction, int speed)
    {
        var s = Math.Clamp(speed, 1, 100);
#pragma warning disable format // Aligned as a table so each row reads against the others.
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
#pragma warning restore format
    }

    // The protocol level's login: the KLAP handshake with the protocol's account, nothing sent to the camera beyond it (ADR-61).
    public async Task<ProtocolAnswer> CheckLoginAsync(Camera camera, TimeProvider time, CancellationToken ct)
    {
        using var expiry = new CancellationTokenSource(TimeSpan.FromSeconds(5), time);
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(ct, expiry.Token);
        try
        {
            return await AuthenticateAsync(camera, linked.Token) is not null
                ? ProtocolAnswer.Answers()
                : ProtocolAnswer.Refused($"Tapo KLAP: {camera.Host} refused the handshake (wrong account or firmware without KLAP).");
        }
        catch (HttpRequestException ex)
        {
            return ProtocolAnswer.Unreachable($"Tapo KLAP: {camera.Host} did not answer the handshake ({ex.HttpRequestError}).");
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            return ProtocolAnswer.Unreachable($"Tapo KLAP: {camera.Host} did not answer the handshake within 5 s.");
        }
    }

    private async Task<KlapSession?> AuthenticateAsync(Camera camera, CancellationToken ct)
    {
        var http = httpClientFactory.CreateClient("tapo");
        var baseUrl = $"http://{camera.Host}:{camera.PortOf(SupportedProtocol.TapoKlap)}";
        // KLAP may want the Tapo cloud account while RTSP and ONVIF take the local one (ADR-61).
        var account = camera.CredentialsFor(SupportedProtocol.TapoKlap);
        var username = account.Username ?? "admin";
        var password = account.Password ?? string.Empty;

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
        return new KlapSession(key, iv, cookie);
    }

    private async Task SendCommandAsync(Camera camera, KlapSession session, string commandJson, CancellationToken ct)
    {
        var http = httpClientFactory.CreateClient("tapo");

        var (payload, seq) = Encrypt(session, commandJson);
        using var content = new ByteArrayContent(payload);
        content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/octet-stream");

        var request = new HttpRequestMessage(HttpMethod.Post, $"http://{camera.Host}:{camera.PortOf(SupportedProtocol.TapoKlap)}/app?seq={seq}");
        request.Content = content;
        request.Headers.Add("Cookie", session.Cookie);

        var response = await http.SendAsync(request, ct);
        response.EnsureSuccessStatusCode();
    }

    internal static byte[] ComputeCredentialHash(string username, string password)
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
        var seq = session.NextSeq();
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

    // Each command of a session takes the next sequence number, so a held session can carry many (ADR-60).
    private sealed class KlapSession(byte[] key, byte[] iv, string cookie)
    {
        private int _seq;

        public byte[] Key { get; } = key;
        public byte[] Iv { get; } = iv;
        public string Cookie { get; } = cookie;

        public int NextSeq() => Interlocked.Increment(ref _seq);
    }
}
