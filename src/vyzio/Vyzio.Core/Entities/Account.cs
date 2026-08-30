using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Vyzio.Core.Entities;

/// <summary>
/// What an account may do. Two values, never a permission matrix: the line is use versus configure,
/// not see versus not see — a resident already sees every image (ADR-54).
/// </summary>
public enum AccountRole
{
    /// <summary>Configures the installation and reads its secrets.</summary>
    Owner,

    /// <summary>Uses the installation: live view, history, and cutting a camera off.</summary>
    Resident
}

/// <summary>
/// A human access to the installation. One account and one role are populated today; the role exists
/// from the first migration because a barrier that ignores it cannot be widened without reopening
/// every route and every screen (ADR-54).
/// </summary>
[Table("accounts")]
public class Account
{
    /// <summary>Below this, a password on a home network is a formality.</summary>
    public const int MinimumPasswordLength = 8;

    /// <summary>How long a host-side reset leaves the installation open to be claimed (ADR-54).</summary>
    public static readonly TimeSpan ResetWindow = TimeSpan.FromMinutes(30);

    [Key]
    public string Id { get; set; } = Guid.NewGuid().ToString("N");

    /// <summary>
    /// Hashed, never encrypted: nothing in the product ever needs to read it back. Null only between a
    /// host-side reset and the new password being chosen on screen (ADR-54).
    /// </summary>
    [MaxLength(200)]
    public required string? PasswordHash { get; set; }

    public AccountRole Role { get; set; } = AccountRole.Owner;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset? PasswordChangedAt { get; set; }

    /// <summary>When the host-side reset removed the password, which is what bounds the window.</summary>
    public DateTimeOffset? PasswordForgottenAt { get; set; }

    public bool HasPassword => !string.IsNullOrEmpty(PasswordHash);

    /// <summary>
    /// Whether anyone reaching the interface may claim this account. Bounded on purpose: the reset is
    /// deliberate, but leaving the door open all night because someone was interrupted is not (ADR-54).
    /// </summary>
    public bool IsOpenForReset(DateTimeOffset now)
        => !HasPassword && PasswordForgottenAt is { } forgotten && now - forgotten < ResetWindow;

    /// <summary>Drops the password without touching the account: the role and its history survive.</summary>
    public void ForgetPassword(DateTimeOffset now)
    {
        PasswordHash = null;
        PasswordForgottenAt = now;
    }

    public void SetPassword(string hash, DateTimeOffset now)
    {
        PasswordHash = hash;
        PasswordForgottenAt = null;
        PasswordChangedAt = now;
    }

    public static bool IsAcceptablePassword(string? password)
        => !string.IsNullOrWhiteSpace(password) && password.Length >= MinimumPasswordLength;
}
