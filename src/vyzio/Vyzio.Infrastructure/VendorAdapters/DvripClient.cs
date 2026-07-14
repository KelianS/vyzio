using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Logging;
using Vyzio.Core.Entities;

namespace Vyzio.Infrastructure.VendorAdapters;

// Thrown on a diagnosable DVRIP failure (login rejected, Ret != 100, connection error) —
// propagated so ProbeCameraCapabilityUseCase surfaces it as LastError instead of a generic
// message (same rationale as OnvifCallException, ADR-28 follow-up).
public sealed class DvripCallException(string message, Exception? inner = null) : Exception(message, inner);

// Pure DVRIP (Xiongmai/XMEye "Sofia") protocol client — binary framing over TCP port 34567,
// JSON payloads. Covers ICSee, Annke, Sannce, Zosi and other XMEye-chipset cameras.
// Wire format and command codes confirmed against real hardware —
// see docs/investigations/icsee_dvrip_privacy.md. Registered as Singleton: stateless.
internal sealed class DvripClient(ILogger<DvripClient> logger)
{
    private const int DvripPort = 34567;
    private const int LoginCmd = 1000;
    private const int ConfigGetCmd = 1042;
    private const int ConfigSetCmd = 1044;

    // Opens a fresh connection, logs in, sends one command, and returns the raw response —
    // used by PTZ (cmd 1400) and any other one-shot command. Never throws on failure; callers
    // that need a real diagnostic (e.g. ImageSettings) should use ConfigGetAsync/ConfigSetAsync
    // or check the response themselves.
    public async Task<string?> ExecuteAsync(Camera camera, int cmdCode, Func<string, string> buildPayload, CancellationToken ct)
    {
        using var tcp = new TcpClient();
        await tcp.ConnectAsync(camera.Host, DvripPort, ct);
        using var stream = tcp.GetStream();

        var sessionId = await LoginAsync(stream, camera, ct);
        if (sessionId is null) return null;

        var payload = buildPayload(sessionId);
        await SendPacketAsync(stream, cmdCode, payload, 2, sessionId, ct);
        return await ReceivePacketAsync(stream, ct);
    }

    // True if login succeeds — used as the connectivity probe (no side effect on the camera).
    public async Task<bool> TryLoginAsync(Camera camera, CancellationToken ct)
    {
        try
        {
            using var tcp = new TcpClient();
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(TimeSpan.FromSeconds(3));
            await tcp.ConnectAsync(camera.Host, DvripPort, timeout.Token);
            using var stream = tcp.GetStream();
            var sessionId = await LoginAsync(stream, camera, timeout.Token);
            return sessionId is not null;
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "DVRIP login probe failed for {Camera}.", camera.DisplayName);
            return false;
        }
    }

    // ConfigManager.getConfig (cmd 1042) — returns the raw config node for configName
    // (e.g. "AVEnc.VideoColor.[0]"), or throws DvripCallException with the real reason.
    public async Task<JsonNode?> ConfigGetAsync(Camera camera, string configName, CancellationToken ct)
    {
        using var tcp = new TcpClient();
        try
        {
            await tcp.ConnectAsync(camera.Host, DvripPort, ct);
        }
        catch (Exception ex)
        {
            throw new DvripCallException($"Impossible de joindre le service DVRIP sur {camera.Host}:{DvripPort} ({ex.Message}).", ex);
        }
        using var stream = tcp.GetStream();

        var sessionId = await LoginAsync(stream, camera, ct);
        if (sessionId is null)
            throw new DvripCallException($"Connexion DVRIP refusée par {camera.Host} (identifiants invalides).");

        var payload = JsonSerializer.Serialize(new { Name = configName, SessionID = sessionId });
        await SendPacketAsync(stream, ConfigGetCmd, payload, 2, sessionId, ct);
        var response = await ReceivePacketAsync(stream, ct);
        if (response is null)
            throw new DvripCallException($"Pas de réponse DVRIP ConfigGet '{configName}' de {camera.Host}.");

        JsonNode? doc;
        try { doc = JsonNode.Parse(response); }
        catch (Exception ex) { throw new DvripCallException($"Réponse DVRIP illisible pour '{configName}' : {ex.Message}", ex); }

        var ret = doc?["Ret"]?.GetValue<int>();
        if (ret != 100)
            throw new DvripCallException($"La caméra a refusé ConfigGet '{configName}' (Ret={ret?.ToString() ?? "?"}).");

        return doc?[configName];
    }

    // ConfigManager.setConfig (cmd 1044) — writes back the full config node for configName.
    // Callers must round-trip: read via ConfigGetAsync, mutate only the known fields, write the
    // whole node back — never construct a config from scratch (unknown/undocumented schema per
    // firmware, ADR-29).
    public async Task ConfigSetAsync(Camera camera, string configName, JsonNode config, CancellationToken ct)
    {
        using var tcp = new TcpClient();
        try
        {
            await tcp.ConnectAsync(camera.Host, DvripPort, ct);
        }
        catch (Exception ex)
        {
            throw new DvripCallException($"Impossible de joindre le service DVRIP sur {camera.Host}:{DvripPort} ({ex.Message}).", ex);
        }
        using var stream = tcp.GetStream();

        var sessionId = await LoginAsync(stream, camera, ct);
        if (sessionId is null)
            throw new DvripCallException($"Connexion DVRIP refusée par {camera.Host} (identifiants invalides).");

        var payload = new JsonObject
        {
            ["Name"] = configName,
            ["SessionID"] = sessionId,
            [configName] = config.DeepClone(),
        };
        await SendPacketAsync(stream, ConfigSetCmd, payload.ToJsonString(), 2, sessionId, ct);
        var response = await ReceivePacketAsync(stream, ct);

        var ret = response is null ? (int?)null : JsonNode.Parse(response)?["Ret"]?.GetValue<int>();
        if (ret != 100)
            throw new DvripCallException($"La caméra a refusé ConfigSet '{configName}' (Ret={(ret?.ToString() ?? "aucune réponse")}).");
    }

    internal static async Task<string?> LoginAsync(NetworkStream stream, Camera camera, CancellationToken ct)
    {
        var hash = SofiaHash(camera.Password ?? string.Empty);
        var loginPayload = JsonSerializer.Serialize(new
        {
            LoginType = "DVRIP-Web",
            Name = camera.Username ?? "admin",
            PassWord = hash,
            EncryptType = "MD5"
        });

        await SendPacketAsync(stream, LoginCmd, loginPayload, 0, "0x00000000", ct);
        var response = await ReceivePacketAsync(stream, ct);
        if (response is null) return null;

        try
        {
            var doc = JsonNode.Parse(response);
            var ret = doc?["Ret"]?.GetValue<int>();
            if (ret != 100) return null;
            return doc?["SessionID"]?.GetValue<string>();
        }
        catch
        {
            return null;
        }
    }

    // Sofia hash: pairs of nibble values (0-15) from MD5 hex, summed mod 62, mapped to [0-9A-Za-z].
    internal static string SofiaHash(string password)
    {
        var md5 = System.Security.Cryptography.MD5.HashData(Encoding.UTF8.GetBytes(password));
        var hex = Convert.ToHexString(md5).ToLowerInvariant();
        var sb = new StringBuilder(16);
        for (var i = 0; i < 32; i += 2)
        {
            var b = (HexNibble(hex[i]) + HexNibble(hex[i + 1])) % 62;
            sb.Append(b < 10 ? (char)('0' + b) : b < 36 ? (char)('A' + b - 10) : (char)('a' + b - 36));
        }
        return sb.ToString();
    }

    private static int HexNibble(char c) => c >= 'a' ? c - 'a' + 10 : c - '0';

    internal static async Task SendPacketAsync(NetworkStream stream, int cmdCode, string json, int seqNo, string sessionId, CancellationToken ct)
    {
        var sessionInt = sessionId.StartsWith("0x", StringComparison.OrdinalIgnoreCase)
            ? Convert.ToInt32(sessionId, 16)
            : 0;

        var body = Encoding.UTF8.GetBytes(json + "\n\0");
        var header = new byte[22];
        header[0] = 0xFF;
        header[1] = 0x01;
        header[2] = 0x00;
        header[3] = 0x00;
        WriteInt32Le(header, 4, sessionInt);
        WriteInt32Le(header, 8, seqNo);
        WriteInt16Le(header, 16, (short)cmdCode);
        WriteInt32Le(header, 18, body.Length);

        await stream.WriteAsync(header, ct);
        await stream.WriteAsync(body, ct);
    }

    internal static async Task<string?> ReceivePacketAsync(NetworkStream stream, CancellationToken ct)
    {
        var header = new byte[22];
        var read = 0;
        while (read < 22)
        {
            var n = await stream.ReadAsync(header.AsMemory(read, 22 - read), ct);
            if (n == 0) return null;
            read += n;
        }

        var dataLen = ReadInt32Le(header, 18);
        if (dataLen <= 0 || dataLen > 65536) return null;

        var body = new byte[dataLen];
        read = 0;
        while (read < dataLen)
        {
            var n = await stream.ReadAsync(body.AsMemory(read, dataLen - read), ct);
            if (n == 0) break;
            read += n;
        }

        var len = read;
        while (len > 0 && (body[len - 1] == 0 || body[len - 1] == '\n')) len--;
        return Encoding.UTF8.GetString(body, 0, len);
    }

    internal static bool IsRetOk(string? json)
    {
        if (json is null) return false;
        try { return JsonNode.Parse(json)?["Ret"]?.GetValue<int>() == 100; }
        catch { return false; }
    }

    private static void WriteInt32Le(byte[] buf, int offset, int value)
    {
        buf[offset]     = (byte)value;
        buf[offset + 1] = (byte)(value >> 8);
        buf[offset + 2] = (byte)(value >> 16);
        buf[offset + 3] = (byte)(value >> 24);
    }

    private static void WriteInt16Le(byte[] buf, int offset, short value)
    {
        buf[offset]     = (byte)value;
        buf[offset + 1] = (byte)(value >> 8);
    }

    private static int ReadInt32Le(byte[] buf, int offset)
        => buf[offset] | (buf[offset + 1] << 8) | (buf[offset + 2] << 16) | (buf[offset + 3] << 24);
}
