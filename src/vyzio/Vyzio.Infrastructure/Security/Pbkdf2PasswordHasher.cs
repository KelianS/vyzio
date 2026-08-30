using System.Security.Cryptography;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.Security;

/// <summary>
/// PBKDF2-SHA256, parameters stored beside the hash so raising them later leaves old passwords readable.
/// Format: <c>pbkdf2-sha256$iterations$salt$hash</c>, both halves base64.
/// </summary>
public sealed class Pbkdf2PasswordHasher : IPasswordHasher
{
    private const string Prefix = "pbkdf2-sha256";
    private const int SaltBytes = 16;
    private const int HashBytes = 32;
    private const int DefaultIterations = 210_000;

    public string Hash(string password)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(password);

        var salt = RandomNumberGenerator.GetBytes(SaltBytes);
        var hash = Derive(password, salt, DefaultIterations);

        return $"{Prefix}${DefaultIterations}${Convert.ToBase64String(salt)}${Convert.ToBase64String(hash)}";
    }

    public bool Verify(string password, string hash)
    {
        if (string.IsNullOrWhiteSpace(password) || string.IsNullOrWhiteSpace(hash)) return false;

        var parts = hash.Split('$');
        if (parts.Length != 4 || parts[0] != Prefix) return false;
        if (!int.TryParse(parts[1], out var iterations) || iterations <= 0) return false;

        byte[] salt, expected;
        try
        {
            salt = Convert.FromBase64String(parts[2]);
            expected = Convert.FromBase64String(parts[3]);
        }
        catch (FormatException)
        {
            return false;
        }

        // Constant time: a comparison that returns early tells how much of the hash was right.
        return CryptographicOperations.FixedTimeEquals(Derive(password, salt, iterations, expected.Length), expected);
    }

    private static byte[] Derive(string password, byte[] salt, int iterations, int length = HashBytes)
        => Rfc2898DeriveBytes.Pbkdf2(password, salt, iterations, HashAlgorithmName.SHA256, length);
}
