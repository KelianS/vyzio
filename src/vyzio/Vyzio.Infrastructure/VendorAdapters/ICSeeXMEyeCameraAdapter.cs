using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Logging;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.VendorAdapters;

// ICSee / XMEye cameras (Xiongmai chipset) — proprietary DVRIP protocol (port 34567).
//
// Privacy mode investigation (June 2026, 192.168.1.193): no local command cuts the XMEye P2P cloud stream.
// See docs/investigations/icsee_dvrip_privacy.md for full results.
// PTZ parking is the only viable hardware mechanism for these cameras.
//
// DVRIP header (22 bytes): FF 01 00 00 | sessionId(4 LE) | seqNo(4 LE) | 00 00 00 00 | cmdCode(2 LE) | dataLen(4 LE)
// JSON body terminated by \n\0.
// Sofia password hash: pairs of MD5 hex chars summed mod 62, mapped to [0-9A-Za-z].
public sealed class ICSeeXMEyeCameraAdapter(ILogger<ICSeeXMEyeCameraAdapter> logger) : IVendorCameraAdapter
{
    private const int DvripPort = 34567;
    private const int LoginCmd = 1000;
    private const int PtzCmd = 1400;

    public string VendorFamily => "icsee";

    public Task<bool> SupportsPrivacyModeAsync(Camera camera, CancellationToken ct = default)
    {
        logger.LogDebug("ICSee/XMEye: no hardware privacy cut for {Camera}. Frigate fallback applies.", camera.DisplayName);
        return Task.FromResult(false);
    }

    public Task SetPrivacyModeAsync(Camera camera, bool active, CancellationToken ct = default)
        => Task.CompletedTask;

    public Task<bool> SupportsPtzAsync(Camera camera, CancellationToken ct = default)
        => Task.FromResult(true);

    public async Task PtzMoveAsync(Camera camera, PtzDirection direction, int speed, CancellationToken ct = default)
    {
        var command = DirectionToCommand(direction);
        var step = Math.Clamp(speed / 12, 1, 8); // map 0-100 → 1-8
        await ExecutePtzAsync(camera, "Start", command, 65535, step, ct);
    }

    public async Task PtzStopAsync(Camera camera, CancellationToken ct = default)
    {
        await ExecutePtzAsync(camera, "Stop", "DirectionUp", 65535, 0, ct);
    }

    public async Task PtzGoToPresetAsync(Camera camera, int presetId, CancellationToken ct = default)
    {
        await ExecutePtzAsync(camera, "Start", "GotoPreset", presetId, 0, ct);
    }

    public async Task PtzSavePresetAsync(Camera camera, int presetId, CancellationToken ct = default)
    {
        await ExecutePtzAsync(camera, "Start", "SetPreset", presetId, 0, ct);
    }

    private async Task ExecutePtzAsync(Camera camera, string action, string command, int preset, int step, CancellationToken ct)
    {
        try
        {
            using var tcp = new TcpClient();
            await tcp.ConnectAsync(camera.Host, DvripPort, ct);
            using var stream = tcp.GetStream();

            var sessionId = await LoginAsync(stream, camera, ct);
            if (sessionId is null)
            {
                logger.LogWarning("ICSee DVRIP login failed for {Camera} — PTZ skipped.", camera.DisplayName);
                return;
            }

            var payload = BuildPtzPayload(sessionId, action, command, preset, step);
            await SendPacketAsync(stream, PtzCmd, payload, 2, sessionId, ct);
            var response = await ReceivePacketAsync(stream, ct);

            if (!IsRetOk(response))
                logger.LogWarning("ICSee PTZ {Action}/{Command} returned non-OK for {Camera}: {Resp}.", action, command, camera.DisplayName, response);
            else
                logger.LogDebug("ICSee PTZ {Action}/{Command} OK for {Camera}.", action, command, camera.DisplayName);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "ICSee DVRIP PTZ error for {Camera}.", camera.DisplayName);
        }
    }

    private async Task<string?> LoginAsync(NetworkStream stream, Camera camera, CancellationToken ct)
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

    private static string BuildPtzPayload(string sessionId, string action, string command, int preset, int step)
    {
        return JsonSerializer.Serialize(new
        {
            Name = "OPPTZControl",
            SessionID = sessionId,
            OPPTZControl = new
            {
                Action = action,
                Command = command,
                Parameter = new
                {
                    AUX = new { Number = 0, Status = "On" },
                    Channel = 0,
                    MenuOpts = "Enter",
                    POINT = new { bottom = 0, left = 0, right = 0, top = 0 },
                    Pattern = "SetBegin",
                    Preset = preset,
                    Step = step,
                    Tour = 0
                }
            }
        });
    }

    private static async Task SendPacketAsync(NetworkStream stream, int cmdCode, string json, int seqNo, string sessionId, CancellationToken ct)
    {
        // Parse sessionId from "0x00000001" or "0x..." format
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
        // bytes 12-15: 00 00 00 00
        WriteInt16Le(header, 16, (short)cmdCode);
        WriteInt32Le(header, 18, body.Length);

        await stream.WriteAsync(header, ct);
        await stream.WriteAsync(body, ct);
    }

    private static async Task<string?> ReceivePacketAsync(NetworkStream stream, CancellationToken ct)
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

        // Strip trailing \n\0 if present
        var len = read;
        while (len > 0 && (body[len - 1] == 0 || body[len - 1] == '\n')) len--;
        return Encoding.UTF8.GetString(body, 0, len);
    }

    // Sofia hash: pairs of nibble values (0-15) from MD5 hex, summed mod 62, mapped to [0-9A-Za-z].
    // Validated live against 192.168.1.193: sofia_hash("a4m3h5") == "6DDKEOQCGQGGILIK"
    internal static string SofiaHash(string password)
    {
        var md5 = MD5.HashData(Encoding.UTF8.GetBytes(password));
        var hex = Convert.ToHexString(md5).ToLowerInvariant();
        var sb = new StringBuilder(16);
        for (var i = 0; i < 32; i += 2)
        {
            // Each hex digit gives its nibble value 0–15, NOT its ASCII value.
            var b = (HexNibble(hex[i]) + HexNibble(hex[i + 1])) % 62;
            sb.Append(b < 10 ? (char)('0' + b) : b < 36 ? (char)('A' + b - 10) : (char)('a' + b - 36));
        }
        return sb.ToString();
    }

    private static int HexNibble(char c) => c >= 'a' ? c - 'a' + 10 : c - '0';

    private static string DirectionToCommand(PtzDirection direction) => direction switch
    {
        PtzDirection.Up        => "DirectionUp",
        PtzDirection.Down      => "DirectionDown",
        PtzDirection.Left      => "DirectionLeft",
        PtzDirection.Right     => "DirectionRight",
        PtzDirection.UpLeft    => "DirectionLeftUp",
        PtzDirection.UpRight   => "DirectionRightUp",
        PtzDirection.DownLeft  => "DirectionLeftDown",
        PtzDirection.DownRight => "DirectionRightDown",
        _                      => "DirectionUp"
    };

    private static bool IsRetOk(string? json)
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
