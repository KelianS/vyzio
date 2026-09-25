using System.Globalization;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.Services;

// Asks once without an account, then once with the camera's own, in the scheme the camera named (ADR-58).
internal sealed partial class RtspAccountProbe(TimeProvider time, ILogger<RtspAccountProbe> logger) : IRtspAccountProbe
{
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(3);

    public async Task<RtspAccountCheck> CheckAsync(Camera camera, CancellationToken ct = default)
    {
        // The URI never carries the account: credentials travel only in the Authorization header.
        var uri = new UriBuilder("rtsp", camera.Host, camera.Port, camera.StreamPath?.TrimStart('/') ?? string.Empty).Uri.ToString();
        try
        {
            var first = await DescribeAsync(camera, uri, cseq: 1, authorization: null, ct);
            if (first.Status != 401) return first.Status == 0 ? RtspAccountCheck.NoAnswer : RtspAccountCheck.Accepted;
            if (string.IsNullOrEmpty(camera.Username)) return RtspAccountCheck.Refused;

            var authorization = Authorize(first.Challenge, camera.Username, camera.Password ?? string.Empty, uri);
            if (authorization is null) return RtspAccountCheck.NoAnswer;

            var second = await DescribeAsync(camera, uri, cseq: 2, authorization, ct);
            return second.Status switch
            {
                0 => RtspAccountCheck.NoAnswer,
                401 or 403 => RtspAccountCheck.Refused,
                _ => RtspAccountCheck.Accepted,
            };
        }
        catch (Exception ex) when (ex is SocketException or IOException or OperationCanceledException && !ct.IsCancellationRequested)
        {
            logger.LogInformation("RTSP account probe on {CameraId}: no answer ({Reason}).", camera.Id, ex.GetType().Name);
            return RtspAccountCheck.NoAnswer;
        }
    }

    private async Task<(int Status, string? Challenge)> DescribeAsync(
        Camera camera, string uri, int cseq, string? authorization, CancellationToken ct)
    {
        using var expiry = new CancellationTokenSource(Timeout, time);
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(ct, expiry.Token);
        using var client = new TcpClient();
        await client.ConnectAsync(camera.Host, camera.Port, linked.Token);
        var stream = client.GetStream();

        var request = new StringBuilder()
            .Append(CultureInfo.InvariantCulture, $"DESCRIBE {uri} RTSP/1.0\r\n")
            .Append(CultureInfo.InvariantCulture, $"CSeq: {cseq}\r\n")
            .Append("Accept: application/sdp\r\nUser-Agent: Vyzio\r\n");
        if (authorization is not null) request.Append(CultureInfo.InvariantCulture, $"Authorization: {authorization}\r\n");
        request.Append("\r\n");
        await stream.WriteAsync(Encoding.ASCII.GetBytes(request.ToString()), linked.Token);

        var head = await ReadHeadAsync(stream, linked.Token);
        var status = StatusLine().Match(head);
        if (!status.Success) return (0, null);

        var challenges = Challenge().Matches(head).Select(m => m.Groups[1].Value.Trim()).ToList();
        // Digest first when offered: it never sends the password itself.
        var challenge = challenges.FirstOrDefault(c => c.StartsWith("Digest", StringComparison.OrdinalIgnoreCase))
            ?? challenges.FirstOrDefault();
        return (int.Parse(status.Groups[1].Value, CultureInfo.InvariantCulture), challenge);
    }

    private static async Task<string> ReadHeadAsync(NetworkStream stream, CancellationToken ct)
    {
        var buffer = new byte[4096];
        var total = 0;
        while (total < buffer.Length)
        {
            var read = await stream.ReadAsync(buffer.AsMemory(total), ct);
            if (read == 0) break;
            total += read;
            if (Encoding.ASCII.GetString(buffer, 0, total).Contains("\r\n\r\n", StringComparison.Ordinal)) break;
        }
        return Encoding.ASCII.GetString(buffer, 0, total);
    }

    private static string? Authorize(string? challenge, string username, string password, string uri)
    {
        if (challenge is null) return null;
        if (challenge.StartsWith("Basic", StringComparison.OrdinalIgnoreCase))
            return "Basic " + Convert.ToBase64String(Encoding.UTF8.GetBytes($"{username}:{password}"));
        if (!challenge.StartsWith("Digest", StringComparison.OrdinalIgnoreCase)) return null;

        var parameters = DigestParameter().Matches(challenge)
            .ToDictionary(m => m.Groups[1].Value.ToLowerInvariant(), m => m.Groups[2].Success ? m.Groups[2].Value : m.Groups[3].Value);
        if (!parameters.TryGetValue("realm", out var realm) || !parameters.TryGetValue("nonce", out var nonce)) return null;

        var ha1 = Md5($"{username}:{realm}:{password}");
        var ha2 = Md5($"DESCRIBE:{uri}");
        var header = new StringBuilder().Append(CultureInfo.InvariantCulture,
            $"Digest username=\"{username}\", realm=\"{realm}\", nonce=\"{nonce}\", uri=\"{uri}\"");

        if (parameters.TryGetValue("qop", out var qop) && qop.Split(',').Any(q => q.Trim() == "auth"))
        {
            var cnonce = Convert.ToHexStringLower(RandomNumberGenerator.GetBytes(8));
            const string nc = "00000001";
            header.Append(CultureInfo.InvariantCulture,
                $", qop=auth, nc={nc}, cnonce=\"{cnonce}\", response=\"{Md5($"{ha1}:{nonce}:{nc}:{cnonce}:auth:{ha2}")}\"");
        }
        else
        {
            header.Append(CultureInfo.InvariantCulture, $", response=\"{Md5($"{ha1}:{nonce}:{ha2}")}\"");
        }

        if (parameters.TryGetValue("opaque", out var opaque)) header.Append(CultureInfo.InvariantCulture, $", opaque=\"{opaque}\"");
        return header.ToString();
    }

#pragma warning disable CA5351 // RTSP Digest (RFC 2617) is defined over MD5; the camera chooses, not Vyzio.
    private static string Md5(string value) => Convert.ToHexStringLower(MD5.HashData(Encoding.UTF8.GetBytes(value)));
#pragma warning restore CA5351

    [GeneratedRegex(@"^RTSP/1\.0 (\d{3})", RegexOptions.Multiline)]
    private static partial Regex StatusLine();

    [GeneratedRegex(@"^WWW-Authenticate:\s*(.+?)\r?$", RegexOptions.Multiline | RegexOptions.IgnoreCase)]
    private static partial Regex Challenge();

    [GeneratedRegex(@"(\w+)=(?:""([^""]*)""|([^,\s]+))")]
    private static partial Regex DigestParameter();
}
