using System.Buffers.Binary;
using System.Collections.Concurrent;
using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Logging;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.VendorAdapters;

// Raw V380 Pro port-8800 protocol client (Anyka AK3918E chipset).
// Handles UDP discovery (cmd NVDEVSEARCH), auth (cmd 1167), stream login (cmd 301/303),
// binary frame reading, and generic command sending on the stream connection.
//
// Registered as Singleton: the deviceId cache survives across scoped requests.
// Other capability providers (e.g. future V380ConfigProvider) can inject this class
// to reuse the protocol primitives without depending on any PTZ logic.
internal sealed class V380Client(ILogger<V380Client> logger)
{
    private const int DiscoveryPort = 10008;
    private const int DiscoveryTimeoutMs = 1500;
    private const int DefaultTimeoutMs = 5000;

    // Charset matches the Python probe: string.ascii_letters + string.digits + '!@#$%^&*()_+-='
    private const string Charset =
        "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=";

    internal static ReadOnlySpan<byte> StaticKey => "macrovideo+*#!^@"u8;

    internal const int AuthCommand = 1167;

    // The auth frame carries the session key there, the encrypted password right after it.
    internal const int AuthSessionKeyOffset = 81;

    // Device IDs are stable per physical camera — cache by IP for the lifetime of the process.
    private readonly ConcurrentDictionary<string, uint> _deviceIds = new();

    // Called by V380DeviceIdBootstrap to pre-populate the cache from the V380 protocol row,
    // so UDP discovery is not needed on every PTZ command after the initial probe.
    internal void PreloadDeviceId(string host, uint deviceId)
        => _deviceIds[host] = deviceId;

    internal uint? GetCachedDeviceId(string host)
        => _deviceIds.TryGetValue(host, out var id) ? id : null;

    // The protocol level's login: the auth handshake (cmd 1167) with the V380 account and device number (ADR-61).
    public async Task<ProtocolAnswer> CheckLoginAsync(Camera camera, TimeProvider time, CancellationToken ct)
    {
        var port = camera.PortOf(SupportedProtocol.V380);
        var deviceId = await GetOrDiscoverDeviceIdAsync(camera.Host, ct);
        if (deviceId is null)
            return ProtocolAnswer.Refused($"V380: {camera.Host}:{port} answers, but its device number is unknown (not found by discovery, not entered).");

        using var expiry = new CancellationTokenSource(TimeSpan.FromMilliseconds(DefaultTimeoutMs), time);
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct, expiry.Token);
        try
        {
            return await AuthenticateAsync(camera, deviceId.Value, cts.Token) is not null
                ? ProtocolAnswer.Answers()
                : ProtocolAnswer.Refused($"V380: {camera.Host}:{port} refused the account for device {deviceId.Value}.");
        }
        catch (Exception ex) when (ex is OperationCanceledException or SocketException or IOException && !ct.IsCancellationRequested)
        {
            return ProtocolAnswer.Unreachable($"V380: {camera.Host}:{port} did not complete the login ({ex.GetType().Name}).");
        }
    }

    // Returns true if UDP discovery succeeds and auth (cmd 1167) returns a valid ticket.
    public async Task<bool> ProbeAsync(Camera camera, CancellationToken ct = default)
    {
        try
        {
            var deviceId = await GetOrDiscoverDeviceIdAsync(camera.Host, ct);
            if (deviceId is null)
            {
                logger.LogDebug("V380 UDP discovery returned no device ID for {Host}.", camera.Host);
                return false;
            }

            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(DefaultTimeoutMs);
            var ticket = await AuthenticateAsync(camera, deviceId.Value, cts.Token);
            return ticket.HasValue;
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "V380 probe failed for {Camera}.", camera.DisplayName);
            return false;
        }
    }

    // Opens a full stream session (auth → cmd 301 login → cmd 303 start), reads warm-up frames
    // so the camera is ready to process commands, sends packet, drains briefly, then closes.
    // This is the entry point for any command that must be sent on the stream connection (e.g. PTZ).
    public async Task SendStreamCommandAsync(Camera camera, byte[] packet, CancellationToken ct = default)
    {
        var deviceId = await GetOrDiscoverDeviceIdAsync(camera.Host, ct)
            ?? throw new InvalidOperationException(
                $"V380: device ID not found for {camera.Host}. " +
                "Enter the camera's device number in its V380 protocol (shown in the V380 app).");

        using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        cts.CancelAfter(DefaultTimeoutMs);
        ct = cts.Token;

        var ticket = await AuthenticateAsync(camera, deviceId, ct)
            ?? throw new InvalidOperationException($"V380: authentication failed for {camera.Host}.");

        using var tcp = new TcpClient();
        await tcp.ConnectAsync(camera.Host, camera.PortOf(SupportedProtocol.V380), ct);
        tcp.NoDelay = true;

        var ns = tcp.GetStream();

        // Stream login (cmd 301): sends device ID, ticket, and stream parameters.
        var loginBuf = BuildPacket(301);
        BinaryPrimitives.WriteUInt32LittleEndian(loginBuf.AsSpan(4), deviceId);
        BinaryPrimitives.WriteUInt16LittleEndian(loginBuf.AsSpan(12), 20);
        BinaryPrimitives.WriteUInt32LittleEndian(loginBuf.AsSpan(14), ticket);
        BinaryPrimitives.WriteUInt32LittleEndian(loginBuf.AsSpan(22), 4097);
        BinaryPrimitives.WriteUInt32LittleEndian(loginBuf.AsSpan(26), 1);
        await ns.WriteAsync(loginBuf, ct);

        var resp32 = await ReadExactAsync(ns, 32, ct);
        var sessionToken = BinaryPrimitives.ReadUInt32LittleEndian(resp32.AsSpan(4));

        // Stream start (cmd 303): activates the video stream.
        var startBuf = BuildPacket(303);
        BinaryPrimitives.WriteUInt32LittleEndian(startBuf.AsSpan(4), sessionToken);
        await ns.WriteAsync(startBuf, ct);

        // Read warm-up frames: camera only processes stream commands once the client
        // is actively consuming the frame loop (mirrors the prsyahmi/v380 C++ PTZ loop).
        const int warmUpFrames = 5;
        var framesRead = 0;
        while (framesRead < warmUpFrames)
        {
            if (await ReadFrameAsync(ns, ct))
                framesRead++;
        }

        await ns.WriteAsync(packet, ct);

        // Drain briefly so the camera processes the command before the connection closes.
        await DrainFramesAsync(ns, durationMs: 200, ct);
    }

    private async Task<uint?> GetOrDiscoverDeviceIdAsync(string host, CancellationToken ct)
    {
        if (_deviceIds.TryGetValue(host, out var cached))
            return cached;

        var id = await DiscoverDeviceIdAsync(host, ct);
        if (id.HasValue)
            _deviceIds[host] = id.Value;
        return id;
    }

    // Auth handshake (cmd 1167): double-AES-ECB password encryption → ticket.
    // Returns null if authentication is rejected (ticket == 0) or connection fails.
    private static async Task<uint?> AuthenticateAsync(Camera camera, uint deviceId, CancellationToken ct)
    {
        using var tcp = new TcpClient();
        await tcp.ConnectAsync(camera.Host, camera.PortOf(SupportedProtocol.V380), ct);

        var account = camera.CredentialsFor(SupportedProtocol.V380);
        var encPw = GenerateEncryptedPassword(account.Password ?? string.Empty);
        var authBuf = BuildPacket(AuthCommand);
        BinaryPrimitives.WriteUInt32LittleEndian(authBuf.AsSpan(4), 1022);
        authBuf[8] = 2;
        BinaryPrimitives.WriteUInt32LittleEndian(authBuf.AsSpan(9), 1);
        BinaryPrimitives.WriteUInt32LittleEndian(authBuf.AsSpan(13), deviceId);
        var usernameBytes = Encoding.UTF8.GetBytes(account.Username ?? "admin");
        usernameBytes.AsSpan(0, Math.Min(usernameBytes.Length, 32)).CopyTo(authBuf.AsSpan(49));
        encPw.AsSpan().CopyTo(authBuf.AsSpan(AuthSessionKeyOffset));

        var ns = tcp.GetStream();
        await ns.WriteAsync(authBuf, ct);

        var resp = await ReadExactAsync(ns, 256, ct);
        var ticket = BinaryPrimitives.ReadUInt32LittleEndian(resp.AsSpan(13));
        return ticket == 0 ? null : ticket;
    }

    // UDP NVDEVSEARCH discovery. V380PtzProvider tries ONVIF first (via OnvifClient),
    // then falls back here. This keeps V380Client free of ONVIF protocol knowledge.
    private static async Task<uint?> DiscoverDeviceIdAsync(string host, CancellationToken ct)
    {
        var msg = "NVDEVSEARCH^100"u8.ToArray();
        var id = await TrySendDiscoveryAsync(msg, host, ct);
        if (id.HasValue) return id;

        // Subnet broadcast fallback (assumes /24; adequate for most home/SMB setups).
        var parts = host.Split('.');
        if (parts.Length == 4)
        {
            var broadcast = $"{parts[0]}.{parts[1]}.{parts[2]}.255";
            id = await TrySendDiscoveryAsync(msg, broadcast, ct);
            if (id.HasValue) return id;
        }

        return null;
    }

    private static async Task<uint?> TrySendDiscoveryAsync(byte[] msg, string target, CancellationToken ct)
    {
        try
        {
            using var udp = new UdpClient(0);
            udp.EnableBroadcast = true;
            var endpoint = new IPEndPoint(IPAddress.Parse(target), DiscoveryPort);
            await udp.SendAsync(msg, endpoint, ct);

            using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeoutCts.CancelAfter(DiscoveryTimeoutMs);
            var result = await udp.ReceiveAsync(timeoutCts.Token);
            var response = Encoding.ASCII.GetString(result.Buffer);
            var fields = response.Split('^');
            if (fields.Length > 12 && uint.TryParse(fields[12], out var deviceId))
                return deviceId;
        }
        catch { }
        return null;
    }

    // Reads one 12-byte frame header + optional payload. Returns true for video frames (0x7F).
    private static async Task<bool> ReadFrameAsync(NetworkStream ns, CancellationToken ct)
    {
        var hdr = await ReadExactAsync(ns, 12, ct);
        if (hdr[0] == 0x7F)
        {
            var payloadLen = BinaryPrimitives.ReadUInt16LittleEndian(hdr.AsSpan(7));
            if (payloadLen > 0)
                await ReadExactAsync(ns, payloadLen, ct);
            return true;
        }
        return false;
    }

    private static async Task DrainFramesAsync(NetworkStream ns, int durationMs, CancellationToken ct)
    {
        using var drainCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        drainCts.CancelAfter(durationMs);
        try
        {
            while (true)
                await ReadFrameAsync(ns, drainCts.Token);
        }
        catch (OperationCanceledException) { }
        catch (Exception) { } // camera may close connection during drain
    }

    private static async Task<byte[]> ReadExactAsync(NetworkStream ns, int n, CancellationToken ct)
    {
        var buf = new byte[n];
        var offset = 0;
        while (offset < n)
        {
            var read = await ns.ReadAsync(buf.AsMemory(offset, n - offset), ct);
            if (read == 0) throw new EndOfStreamException("V380: connection closed unexpectedly.");
            offset += read;
        }
        return buf;
    }

    // Double AES-ECB encryption: password is first encrypted with the static key,
    // then re-encrypted with a per-session random key. Returns random_key + enc2 (32 bytes).
    private static byte[] GenerateEncryptedPassword(string password)
    {
        var randomKey = new byte[16];
        for (var i = 0; i < 16; i++)
            randomKey[i] = (byte)Charset[RandomNumberGenerator.GetInt32(Charset.Length)];

        var padded = new byte[16];
        var pwBytes = Encoding.UTF8.GetBytes(password);
        pwBytes.AsSpan(0, Math.Min(pwBytes.Length, 16)).CopyTo(padded);

        using var aes1 = Aes.Create();
        aes1.Key = StaticKey.ToArray();
        var enc1 = aes1.EncryptEcb(padded, PaddingMode.None);

        using var aes2 = Aes.Create();
        aes2.Key = randomKey;
        var enc2 = aes2.EncryptEcb(enc1, PaddingMode.None);

        return [.. randomKey, .. enc2];
    }

    // Returns a zeroed 256-byte buffer with the command ID written at offset 0.
    private static byte[] BuildPacket(int cmdId)
    {
        var buf = new byte[256];
        BinaryPrimitives.WriteInt32LittleEndian(buf, cmdId);
        return buf;
    }
}
