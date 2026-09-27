using System.Globalization;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.VendorAdapters;

// Logs in to a camera's RTSP service with the RTSP account: DESCRIBE, then again with Basic or Digest when challenged (ADR-61).
internal static partial class RtspLogin
{
    public static async Task<ProtocolAnswer> CheckAsync(Camera camera, TimeProvider time, CancellationToken ct)
    {
        var port = camera.PortOf(SupportedProtocol.Rtsp);
        var uri = new UriBuilder("rtsp", camera.Host, port) { Path = camera.MainStream?.Path?.TrimStart('/') ?? string.Empty }.Uri.ToString();
        var account = camera.CredentialsFor(SupportedProtocol.Rtsp);

        using var expiry = new CancellationTokenSource(TimeSpan.FromSeconds(3), time);
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(ct, expiry.Token);
        try
        {
            using var tcp = new TcpClient();
            await tcp.ConnectAsync(camera.Host, port, linked.Token);
            var stream = tcp.GetStream();

            var first = await DescribeAsync(stream, uri, 1, authorization: null, linked.Token);
            if (first is null) return ProtocolAnswer.Unreachable($"RTSP: {camera.Host}:{port} gave no RTSP answer.");
            if (!IsUnauthorized(first)) return ProtocolAnswer.Answers();

            if (string.IsNullOrWhiteSpace(account.Username))
                return ProtocolAnswer.Refused($"RTSP: {camera.Host}:{port} asks for an account and none is set.");

            var authorization = AuthorizationFor(first, account, uri);
            var second = await DescribeAsync(stream, uri, 2, authorization, linked.Token);
            return second is null || IsUnauthorized(second)
                ? ProtocolAnswer.Refused($"RTSP: {camera.Host}:{port} refused the account (401 Unauthorized).")
                : ProtocolAnswer.Answers();
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex) when (ex is OperationCanceledException or SocketException or IOException)
        {
            return ProtocolAnswer.Unreachable($"RTSP: {camera.Host}:{port} did not complete the login ({ex.GetType().Name}).");
        }
    }

    private static async Task<string?> DescribeAsync(NetworkStream stream, string uri, int sequence, string? authorization, CancellationToken ct)
    {
        var request = new StringBuilder()
            .Append(CultureInfo.InvariantCulture, $"DESCRIBE {uri} RTSP/1.0\r\n")
            .Append(CultureInfo.InvariantCulture, $"CSeq: {sequence}\r\n")
            .Append("Accept: application/sdp\r\n")
            .Append("User-Agent: Vyzio\r\n");
        if (authorization is not null) request.Append(CultureInfo.InvariantCulture, $"Authorization: {authorization}\r\n");
        request.Append("\r\n");

        await stream.WriteAsync(Encoding.ASCII.GetBytes(request.ToString()), ct);
        var buffer = new byte[4096];
        var read = await stream.ReadAsync(buffer, ct);
        if (read <= 0) return null;

        var answer = Encoding.ASCII.GetString(buffer, 0, read);
        return answer.StartsWith("RTSP/", StringComparison.Ordinal) ? answer : null;
    }

    private static bool IsUnauthorized(string answer)
        => answer.Contains(" 401 ", StringComparison.Ordinal);

    // Digest when the camera offers it, Basic otherwise (RFC 2617, as RTSP cameras implement it).
    private static string AuthorizationFor(string challenge, CameraCredentials account, string uri)
    {
        var username = account.Username ?? string.Empty;
        var password = account.Password ?? string.Empty;
        var digest = DigestChallenge().Match(challenge);
        if (!digest.Success)
            return $"Basic {Convert.ToBase64String(Encoding.UTF8.GetBytes($"{username}:{password}"))}";

        var realm = digest.Groups["realm"].Value;
        var nonce = NonceOf().Match(challenge).Groups["nonce"].Value;
        var response = Md5Hex($"{Md5Hex($"{username}:{realm}:{password}")}:{nonce}:{Md5Hex($"DESCRIBE:{uri}")}");
        return $"Digest username=\"{username}\", realm=\"{realm}\", nonce=\"{nonce}\", uri=\"{uri}\", response=\"{response}\"";
    }

    private static string Md5Hex(string value)
    {
#pragma warning disable CA5351 // RTSP Digest authentication is MD5 by protocol, not by choice.
        return Convert.ToHexStringLower(MD5.HashData(Encoding.UTF8.GetBytes(value)));
#pragma warning restore CA5351
    }

    [GeneratedRegex("WWW-Authenticate:\\s*Digest\\s+[^\\r\\n]*realm=\"(?<realm>[^\"]*)\"", RegexOptions.IgnoreCase)]
    private static partial Regex DigestChallenge();

    [GeneratedRegex("WWW-Authenticate:\\s*Digest\\s+[^\\r\\n]*nonce=\"(?<nonce>[^\"]*)\"", RegexOptions.IgnoreCase)]
    private static partial Regex NonceOf();
}
