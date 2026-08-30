using Vyzio.Application.DTOs.Access;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Access;

/// <summary>Tells a fresh install from a locked one — the first thing the interface asks (ADR-54).</summary>
public sealed class GetAccessStateUseCase(IAccountRepository accounts)
{
    public async Task<AccessStateDto> ExecuteAsync(CancellationToken ct = default)
    {
        var owner = await accounts.GetOwnerAsync(ct);
        // An account whose password was just reset from the host reads as a fresh install, and only
        // for as long as the window lasts: past it, the interface locks again rather than stay open.
        var awaitingReset = owner is not null && owner.IsOpenForReset(DateTimeOffset.UtcNow);

        return new AccessStateDto(owner is not null && !awaitingReset, awaitingReset, Account.MinimumPasswordLength);
    }
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
        var now = DateTimeOffset.UtcNow;
        var owner = await accounts.GetOwnerAsync(ct);

        // The route stays open until an owner has a password; racing it must not create a second one.
        if (owner is not null && !owner.IsOpenForReset(now)) return AccessOutcome.Refused(AccessRefusal.AlreadyInstalled);
        if (!Account.IsAcceptablePassword(password)) return AccessOutcome.Refused(AccessRefusal.PasswordTooShort);

        var account = owner;
        if (account is null)
        {
            account = new Account
            {
                PasswordHash = hasher.Hash(password!),
                Role = AccountRole.Owner,
                CreatedAt = now
            };
            await accounts.AddAsync(account, ct);
        }
        else
        {
            // Claiming back an account the host reset: same screen, same rules, the account itself survives.
            account.SetPassword(hasher.Hash(password!), now);
            await accounts.UpdateAsync(account, ct);
        }

        return await SessionOpening.OpenAsync(sessions, account, device, now, ct);
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
        // No password means a reset is pending, or its window closed with nobody claiming it: nothing opens.
        if (account is null || !account.HasPassword) return AccessOutcome.Refused(AccessRefusal.NotInstalled);

        if (string.IsNullOrEmpty(password) || !hasher.Verify(password, account.PasswordHash!))
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

/// <summary>
/// Changing a known password, from the interface. Every device leaves with the old one — otherwise the
/// gesture takes the access back from nobody — and the caller gets a fresh session on the spot (ADR-54).
/// </summary>
public sealed class ChangePasswordUseCase(
    IAccountRepository accounts,
    ISessionRepository sessions,
    IPasswordHasher hasher)
{
    public async Task<AccessOutcome> ExecuteAsync(
        string accountId,
        string? currentPassword,
        string? newPassword,
        string? device,
        CancellationToken ct = default)
    {
        var account = await accounts.GetByIdAsync(accountId, ct);
        if (account is null || !account.HasPassword) return AccessOutcome.Refused(AccessRefusal.NotInstalled);

        // Asked again even though the caller is signed in: an unlocked device left around is not consent.
        if (string.IsNullOrEmpty(currentPassword) || !hasher.Verify(currentPassword, account.PasswordHash!))
            return AccessOutcome.Refused(AccessRefusal.CurrentPasswordWrong);

        if (!Account.IsAcceptablePassword(newPassword)) return AccessOutcome.Refused(AccessRefusal.PasswordTooShort);

        var now = DateTimeOffset.UtcNow;
        account.SetPassword(hasher.Hash(newPassword!), now);
        await accounts.UpdateAsync(account, ct);
        await sessions.RevokeAllAsync(account.Id, now, ct);

        return await SessionOpening.OpenAsync(sessions, account, device, now, ct);
    }
}

/// <summary>
/// The only way back in after a forgotten password, and it runs on the host machine. It removes the
/// password instead of setting one: the new one is chosen on the screen that already knows the rules,
/// and never typed into a shell where it would outlive the command (ADR-54).
/// </summary>
public sealed class ResetOwnerPasswordUseCase(IAccountRepository accounts, ISessionRepository sessions)
{
    /// <summary>Null when there is no owner to reset — a fresh install already asks for a password.</summary>
    public async Task<PasswordResetDto?> ExecuteAsync(CancellationToken ct = default)
    {
        var owner = await accounts.GetOwnerAsync(ct);
        if (owner is null) return null;

        var now = DateTimeOffset.UtcNow;
        owner.ForgetPassword(now);
        await accounts.UpdateAsync(owner, ct);

        // A reset that left one device signed in would reset nothing.
        var closed = await sessions.RevokeAllAsync(owner.Id, now, ct);

        return new PasswordResetDto(closed, now + Account.ResetWindow);
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
