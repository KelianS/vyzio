using Vyzio.Core.Entities;
using Vyzio.Infrastructure.Persistence;

namespace Vyzio.Tests.Integration;

/// <summary>
/// Lets a test harness through the barrier the way a browser does — a real account, a real session,
/// a real cookie. No exemption by environment: one would eventually ship (ADR-54).
/// </summary>
internal static class SignedInTestClient
{
    /// <summary>Fixed so the cookie can be written before the request; only ever seen by tests.</summary>
    private const string Token = "0f8b4c2e1d6a4f5b8c3e7d9a1b2c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e";

    public static string Cookie => $"vyzio_session={Token}";

    /// <summary>Gives the installation an owner already signed in on one device.</summary>
    public static void SeedOwnerSession(VyzioDbContext db)
    {
        ArgumentNullException.ThrowIfNull(db);

        if (db.Accounts.Any()) return;

        var account = new Account { PasswordHash = "seeded-for-tests" };
        db.Accounts.Add(account);
        db.Sessions.Add(Session.Open(account.Id, Fingerprint(Token), "tests", DateTimeOffset.UtcNow));
        db.SaveChanges();
    }

    // Mirrors what the use case stores; the hashing lives there and is not worth a port for one test seam.
    private static string Fingerprint(string token)
        => Convert.ToHexString(
            System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(token)))
            .ToLowerInvariant();
}
