using System.Buffers.Binary;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Vyzio.Infrastructure.VendorAdapters;

namespace Vyzio.Tests.Contracts;

// What a committed fixture must never carry; the only accepted account is the one of neutral-values.json (#92).
internal sealed partial class FixtureHygiene
{
    private static readonly HashSet<string> BinaryFields = ["hex", "header"];

    private readonly string _username;
    private readonly string _probeUsername;
    private readonly IReadOnlyList<string> _passwords;
    private readonly HashSet<string> _sofiaHashes;
    private readonly string _macPrefix;
    private readonly string _adminToken;

    private FixtureHygiene(string username, string probeUsername, IReadOnlyList<string> passwords, string probePassword, string macPrefix, string adminToken)
    {
        _username = username;
        _probeUsername = probeUsername;
        _passwords = passwords;
        _sofiaHashes = [.. passwords.Append(probePassword).Select(DvripClient.SofiaHash)];
        _macPrefix = Bare(macPrefix);
        _adminToken = adminToken;
    }

    public static FixtureHygiene FromNeutralValues()
    {
        var neutral = FixtureLoader.Neutral;
        return new FixtureHygiene(
            neutral.Account.Username,
            neutral.ProbeAccount.Username,
            [neutral.Account.Password, neutral.RefusedPassword],
            neutral.ProbeAccount.Password,
            neutral.MacPrefix,
            neutral.DvripAdminToken);
    }

    // The kind of each leak, never its value: a CI log is public.
    public IReadOnlyList<string> Leaks(string fixtureJson)
    {
        var leaks = new List<string>();
        using var fixture = JsonDocument.Parse(fixtureJson);
        foreach (var (name, value) in Strings(fixture.RootElement, propertyName: null))
        {
            if (name is not null && BinaryFields.Contains(name))
            {
                var bytes = Convert.FromHexString(value);
                leaks.AddRange(TextLeaks(Encoding.Latin1.GetString(bytes)));
                leaks.AddRange(V380PasswordLeaks(bytes));
            }
            else
            {
                leaks.AddRange(TextLeaks(value));
            }
        }
        return [.. leaks.Distinct()];
    }

    private static IEnumerable<(string? Name, string Value)> Strings(JsonElement element, string? propertyName)
    {
        switch (element.ValueKind)
        {
            case JsonValueKind.Object:
                foreach (var property in element.EnumerateObject())
                    foreach (var item in Strings(property.Value, property.Name))
                        yield return item;
                break;
            case JsonValueKind.Array:
                foreach (var item in element.EnumerateArray().SelectMany(child => Strings(child, propertyName)))
                    yield return item;
                break;
            case JsonValueKind.String:
                yield return (propertyName, element.GetString()!);
                break;
        }
    }

    private IEnumerable<string> TextLeaks(string text)
    {
        if (PrivateIp().IsMatch(text)) yield return "private IP address";
        if (PrivateIpv6().IsMatch(text)) yield return "private IPv6 address";
        if (Mac().Matches(text).Select(mac => mac.Value).Concat(BareMacField().Matches(text).Select(mac => mac.Groups[1].Value))
            .Any(mac => !Bare(mac).StartsWith(_macPrefix, StringComparison.Ordinal))) yield return "MAC address";
        if (PrivateKey().IsMatch(text)) yield return "private key";
        if (WsUsername().Matches(text).Any(match => match.Groups[1].Value != _username)) yield return "WS-Security username";
        if (DvripUsername().Matches(text).Any(match => match.Groups[1].Value != _username && match.Groups[1].Value != _probeUsername)) yield return "DVRIP username";
        if (DvripPassword().Matches(text).Any(match => !_sofiaHashes.Contains(match.Groups[1].Value))) yield return "DVRIP password hash";
        if (DvripAdminToken().Matches(text).Any(match => match.Groups[1].Value != _adminToken)) yield return "DVRIP admin token";
        if (UrlPassword().Matches(text).Any(match => match.Groups[1].Value.Length > 0 && !_passwords.Contains(match.Groups[1].Value))) yield return "password in an address";
        if (BasicAuthorization().Matches(text).Any(match => !_passwords.Any(password => DecodedBasic(match.Groups[1].Value) == $"{_username}:{password}"))) yield return "Basic authorization";
        var tokens = WsToken().Matches(text);
        if (tokens.Count < WsPassword().Count(text) || tokens.Any(match => !_passwords.Any(password => WsDigest(match, password) == match.Groups["digest"].Value))) yield return "WS-Security password";
        var digests = RtspDigest().Matches(text);
        if (digests.Count < AnyDigest().Count(text) || digests.Any(match => !IsFixtureRtspDigest(text, match))) yield return "RTSP Digest authorization";
    }

    private bool IsFixtureRtspDigest(string request, Match match)
    {
        var method = request[..Math.Max(request.IndexOf(' ', StringComparison.Ordinal), 0)];
        return match.Groups["username"].Value == _username
            && _passwords.Any(password => RtspDigestResponse(method, match, password) == match.Groups["response"].Value);
    }

    // The V380 auth frame carries the password AES-encrypted under a key sent beside it (V380Client).
    private IEnumerable<string> V380PasswordLeaks(byte[] frame)
    {
        const int keyLength = 16;
        const int passwordOffset = V380Client.AuthSessionKeyOffset + keyLength;
        if (frame.Length < passwordOffset + keyLength || BinaryPrimitives.ReadInt32LittleEndian(frame) != V380Client.AuthCommand) yield break;
        var encrypted = frame.AsSpan(passwordOffset, keyLength);
        if (!encrypted.ContainsAnyExcept((byte)0)) yield break;

        using var sessionAes = Aes.Create();
        sessionAes.Key = frame[V380Client.AuthSessionKeyOffset..passwordOffset];
        using var staticAes = Aes.Create();
        staticAes.Key = V380Client.StaticKey.ToArray();
        var plain = staticAes.DecryptEcb(sessionAes.DecryptEcb(encrypted, PaddingMode.None), PaddingMode.None);
        if (!_passwords.Contains(Encoding.UTF8.GetString(plain).TrimEnd('\0'))) yield return "V380 password";
    }

    private static string Bare(string mac) => mac.Replace(":", string.Empty).Replace("-", string.Empty).ToUpperInvariant();

    private static string? DecodedBasic(string base64)
    {
        try { return Encoding.UTF8.GetString(Convert.FromBase64String(base64)); }
        catch (FormatException) { return null; }
    }

    private static string WsDigest(Match token, string password)
    {
        byte[] nonce;
        try { nonce = Convert.FromBase64String(token.Groups["nonce"].Value); }
        catch (FormatException) { return string.Empty; }
#pragma warning disable CA5350 // WS-Security UsernameToken digest is SHA-1 by specification.
        return Convert.ToBase64String(SHA1.HashData([.. nonce, .. Encoding.UTF8.GetBytes(token.Groups["created"].Value), .. Encoding.UTF8.GetBytes(password)]));
#pragma warning restore CA5350
    }

    private string RtspDigestResponse(string method, Match header, string password)
        => Md5Hex($"{Md5Hex($"{_username}:{header.Groups["realm"].Value}:{password}")}:{header.Groups["nonce"].Value}:{Md5Hex($"{method}:{header.Groups["uri"].Value}")}");

    private static string Md5Hex(string value)
    {
#pragma warning disable CA5351 // RTSP Digest authentication is MD5 by protocol, not by choice.
        return Convert.ToHexStringLower(MD5.HashData(Encoding.UTF8.GetBytes(value)));
#pragma warning restore CA5351
    }

    [GeneratedRegex(@"(?<![\d.])(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|169\.254\.\d{1,3}\.\d{1,3})(?!\d)")]
    private static partial Regex PrivateIp();

    [GeneratedRegex(@"(?<![0-9A-Fa-f:])(?:[Ff][Ee][89AaBb][0-9A-Fa-f]|[Ff][CcDd][0-9A-Fa-f]{2}):[0-9A-Fa-f:]*[0-9A-Fa-f]")]
    private static partial Regex PrivateIpv6();

    // A MAC written without separators is only recognisable by the field that holds it.
    [GeneratedRegex(@"\b(?:mac|macaddr|macaddress|hwaddr)""?\s*[:=^]\s*""?([0-9a-f]{12})(?![0-9a-f])", RegexOptions.IgnoreCase)]
    private static partial Regex BareMacField();

    [GeneratedRegex(@"(?<![0-9A-Fa-f:-])[0-9A-Fa-f]{2}([:-])(?:[0-9A-Fa-f]{2}\1){4}[0-9A-Fa-f]{2}(?![0-9A-Fa-f:-])")]
    private static partial Regex Mac();

    [GeneratedRegex("-----BEGIN [A-Z ]*PRIVATE KEY-----")]
    private static partial Regex PrivateKey();

    [GeneratedRegex(@"<(?:\w+:)?Username>([^<]*)<")]
    private static partial Regex WsUsername();

    [GeneratedRegex(@"""UserName""\s*:\s*""([^""]*)""")]
    private static partial Regex DvripUsername();

    [GeneratedRegex(@"""PassWord""\s*:\s*""([^""]*)""")]
    private static partial Regex DvripPassword();

    [GeneratedRegex(@"""AdminToken""\s*:\s*""([^""]+)""")]
    private static partial Regex DvripAdminToken();

    [GeneratedRegex(@"password=([^&_\s""<]*)", RegexOptions.IgnoreCase)]
    private static partial Regex UrlPassword();

    [GeneratedRegex(@"Authorization:\s*Basic\s+(\S+)", RegexOptions.IgnoreCase)]
    private static partial Regex BasicAuthorization();

    [GeneratedRegex(@"<(?:\w+:)?Password[^>]*>(?<digest>[^<]*)</(?:\w+:)?Password>\s*<(?:\w+:)?Nonce[^>]*>(?<nonce>[^<]*)</(?:\w+:)?Nonce>\s*<(?:\w+:)?Created>(?<created>[^<]*)</")]
    private static partial Regex WsToken();

    [GeneratedRegex(@"<(?:\w+:)?Password[\s>]")]
    private static partial Regex WsPassword();

    [GeneratedRegex(@"Authorization:\s*Digest", RegexOptions.IgnoreCase)]
    private static partial Regex AnyDigest();

    [GeneratedRegex(@"Authorization:\s*Digest\s+username=""(?<username>[^""]*)"",\s*realm=""(?<realm>[^""]*)"",\s*nonce=""(?<nonce>[^""]*)"",\s*uri=""(?<uri>[^""]*)"",\s*response=""(?<response>[^""]*)""", RegexOptions.IgnoreCase)]
    private static partial Regex RtspDigest();
}
