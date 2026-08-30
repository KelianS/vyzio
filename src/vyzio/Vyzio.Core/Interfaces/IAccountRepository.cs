using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

public interface IAccountRepository
{
    /// <summary>Whether the installation has an owner yet — what tells a fresh install from a locked one.</summary>
    Task<bool> AnyAsync(CancellationToken ct = default);

    /// <summary>The single owner. Sign-in has no identifier to go on: there is only one account (ADR-54).</summary>
    Task<Account?> GetOwnerAsync(CancellationToken ct = default);

    Task<Account?> GetByIdAsync(string id, CancellationToken ct = default);

    Task AddAsync(Account account, CancellationToken ct = default);

    Task UpdateAsync(Account account, CancellationToken ct = default);
}
