using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Vyzio.Core.Entities;

/// <summary>
/// One open access from one device, referenced by an opaque cookie. It lives on the server so it can
/// be revoked: a lost phone must stop opening, which no self-contained token allows (ADR-54).
/// </summary>
[Table("sessions")]
public class Session
{
    /// <summary>Long enough that a phone stays signed in, which is what makes people keep a password at all.</summary>
    public static readonly TimeSpan Lifetime = TimeSpan.FromDays(30);

    /// <summary>Renewing on every request would write on every request; a day of drift costs nothing.</summary>
    private static readonly TimeSpan RenewAfter = TimeSpan.FromDays(1);

    [Key]
    public string Id { get; set; } = Guid.NewGuid().ToString("N");

    /// <summary>The cookie is stored hashed: a copy of the database must not hand over live sessions.</summary>
    [Required, MaxLength(64)]
    public required string TokenHash { get; set; }

    [Required, MaxLength(50)]
    public required string AccountId { get; set; }

    /// <summary>What the user recognises in the list before revoking it.</summary>
    [MaxLength(200)]
    public string? Device { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset LastSeenAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset ExpiresAt { get; set; }

    public DateTimeOffset? RevokedAt { get; set; }

    public bool IsUsableAt(DateTimeOffset now) => RevokedAt is null && ExpiresAt > now;

    /// <summary>Slides the window on use. Tells whether anything moved, so most requests cost no write.</summary>
    public bool Touch(DateTimeOffset now)
    {
        if (now - LastSeenAt < RenewAfter) return false;

        LastSeenAt = now;
        ExpiresAt = now + Lifetime;
        return true;
    }

    public static Session Open(string accountId, string tokenHash, string? device, DateTimeOffset now)
        => new()
        {
            AccountId = accountId,
            TokenHash = tokenHash,
            Device = device,
            CreatedAt = now,
            LastSeenAt = now,
            ExpiresAt = now + Lifetime
        };
}
