using Vyzio.Application.DTOs.Access;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Access;

/// <summary>Tells a fresh install from a locked one — the first thing the interface asks (ADR-54).</summary>
public sealed class GetAccessStateUseCase(IAccountRepository accounts)
{
    public async Task<AccessStateDto> ExecuteAsync(CancellationToken ct = default)
        => new(await accounts.AnyAsync(ct), Account.MinimumPasswordLength);
}

/// <summary>
/// Creates the owner and signs them in at once: the password is chosen at the very moment the product
/// is installed, and asking for it again on the next screen would be ceremony (ADR-54).
/// </summary>
public sealed class CreateOwnerAccountUseCase(
    IAccountRepository accounts,
    ISessionRepository sessions,
    IPasswordHasher hasher)
{
    public async Task<AccessOutcome> ExecuteAsync(string? password, string? device, CancellationToken ct = default)
    {
        // The route stays open only until an owner exists; racing it must not create a second one.
        if (await accounts.AnyAsync(ct)) return AccessOutcome.Refused(AccessRefusal.AlreadyInstalled);
        if (!Account.IsAcceptablePassword(password)) return AccessOutcome.Refused(AccessRefusal.PasswordTooShort);

        var account = new Account
        {
            PasswordHash = hasher.Hash(password!),
            Role = AccountRole.Owner,
            CreatedAt = DateTimeOffset.UtcNow
        };
        await accounts.AddAsync(account, ct);

        return await SessionOpening.OpenAsync(sessions, account, device, DateTimeOffset.UtcNow, ct);
    }
}

public sealed class SignInUseCase(
    IAccountRepository accounts,
    ISessionRepository sessions,
    IPasswordHasher hasher)
{
    public async Task<AccessOutcome> ExecuteAsync(string? password, string? device, CancellationToken ct = default)
    {
        var account = await accounts.GetOwnerAsync(ct);
        if (account is null) return AccessOutcome.Refused(AccessRefusal.NotInstalled);

        if (string.IsNullOrEmpty(password) || !hasher.Verify(password, account.PasswordHash))
            return AccessOutcome.Refused(AccessRefusal.WrongPassword);

        return await SessionOpening.OpenAsync(sessions, account, device, DateTimeOffset.UtcNow, ct);
    }
}

public sealed class SignOutUseCase(ISessionRepository sessions)
{
    public Task<bool> ExecuteAsync(string token, CancellationToken ct = default)
        => sessions.RevokeAsync(SessionTokens.Fingerprint(token), DateTimeOffset.UtcNow, ct);
}

/// <summary>The gesture for a lost phone: every device of the account stops opening at once (ADR-54).</summary>
public sealed class SignOutEverywhereUseCase(ISessionRepository sessions)
{
    public Task<int> ExecuteAsync(string accountId, CancellationToken ct = default)
        => sessions.RevokeAllAsync(accountId, DateTimeOffset.UtcNow, ct);
}

/// <summary>
/// Turns a cookie into who is asking, on every authenticated request. Returns null for anything that
/// is not a live session — expired, revoked, unknown, or pointing at a deleted account.
/// </summary>
public sealed class AuthenticateSessionUseCase(
    IAccountRepository accounts,
    ISessionRepository sessions)
{
    public async Task<AuthenticatedSession?> ExecuteAsync(string token, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(token)) return null;

        var now = DateTimeOffset.UtcNow;
        var session = await sessions.GetByTokenHashAsync(SessionTokens.Fingerprint(token), ct);
        if (session is null || !session.IsUsableAt(now)) return null;

        var account = await accounts.GetByIdAsync(session.AccountId, ct);
        if (account is null) return null;

        if (session.Touch(now)) await sessions.UpdateAsync(session, ct);

        return new AuthenticatedSession(account.Id, account.Role, session.ExpiresAt);
    }
}

internal static class SessionOpening
{
    public static async Task<AccessOutcome> OpenAsync(
        ISessionRepository sessions,
        Account account,
        string? device,
        DateTimeOffset now,
        CancellationToken ct)
    {
        var token = SessionTokens.Issue();
        var session = Session.Open(account.Id, SessionTokens.Fingerprint(token), device, now);
        await sessions.AddAsync(session, ct);

        return AccessOutcome.Opened(token, new AuthenticatedSession(account.Id, account.Role, session.ExpiresAt));
    }
}
