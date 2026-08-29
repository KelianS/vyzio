using System.Security.Cryptography;
using System.Text;

namespace Vyzio.Application.UseCases.Access;

/// <summary>
/// The cookie value and what the database keeps of it. The token carries 256 bits of randomness, so
/// the stored form is a plain digest — a slow hash protects guessable secrets, and this is not one.
/// </summary>
internal static class SessionTokens
{
    public static string Issue() => Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();

    public static string Fingerprint(string token)
        => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token))).ToLowerInvariant();
}
