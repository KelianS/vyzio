using Vyzio.Core.Common;
using Vyzio.Core.Entities;

namespace Vyzio.Application.DTOs.Access;

/// <summary>
/// What the interface asks before showing anything: is this installation locked yet, and if it is not,
/// is it because it is brand new or because the host just removed the password (ADR-54).
/// </summary>
public sealed record AccessStateDto(bool Installed, bool AwaitingReset, int MinimumPasswordLength);

/// <summary>
/// Who is asking, as the interface reads it. The account identifier stays inside: a screen decides what
/// to offer from the role, never from an identity it would have to keep.
/// </summary>
public sealed record CurrentSessionDto(string Role, DateTimeOffset ExpiresAt)
{
    public static CurrentSessionDto From(AuthenticatedSession session)
    {
        ArgumentNullException.ThrowIfNull(session);

        return new CurrentSessionDto(SnakeCaseEnum.ToSnakeCase(session.Role), session.ExpiresAt);
    }
}

/// <summary>Who is asking, as the API reads it — typed, because a route decides on the role.</summary>
public sealed record AuthenticatedSession(string AccountId, AccountRole Role, DateTimeOffset ExpiresAt);

public sealed record PasswordRequest(string? Password);

public sealed record ChangePasswordRequest(string? CurrentPassword, string? NewPassword);

/// <summary>What the host-side command reports back, so the operator knows what just happened.</summary>
public sealed record PasswordResetDto(int SessionsClosed, DateTimeOffset WindowClosesAt);

/// <summary>
/// Why access was refused, when it was. A wrong password and an install with no account are told apart
/// here but not to the caller: distinguishing them out loud tells whoever guesses what to work on.
/// </summary>
public enum AccessRefusal
{
    None,
    AlreadyInstalled,
    NotInstalled,
    PasswordTooShort,
    WrongPassword,

    /// <summary>
    /// Told apart from <see cref="WrongPassword"/> because the caller is signed in: answering
    /// "unauthenticated" would throw them out of a screen they legitimately hold (ADR-54).
    /// </summary>
    CurrentPasswordWrong
}

public sealed record AccessOutcome(AccessRefusal Refusal, string? Token, AuthenticatedSession? Session)
{
    public bool Granted => Refusal == AccessRefusal.None;

    public static AccessOutcome Refused(AccessRefusal refusal) => new(refusal, null, null);

    public static AccessOutcome Opened(string token, AuthenticatedSession session)
        => new(AccessRefusal.None, token, session);
}
