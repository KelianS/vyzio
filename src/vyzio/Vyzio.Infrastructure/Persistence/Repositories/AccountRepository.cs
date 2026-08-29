using Microsoft.EntityFrameworkCore;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.Persistence.Repositories;

public sealed class AccountRepository(VyzioDbContext db) : IAccountRepository
{
    public Task<bool> AnyAsync(CancellationToken ct = default)
        => db.Accounts.AnyAsync(ct);

    public Task<Account?> GetOwnerAsync(CancellationToken ct = default)
        => db.Accounts
            .Where(account => account.Role == AccountRole.Owner)
            .OrderBy(account => account.CreatedAt)
            .FirstOrDefaultAsync(ct);

    public Task<Account?> GetByIdAsync(string id, CancellationToken ct = default)
        => db.Accounts.FirstOrDefaultAsync(account => account.Id == id, ct);

    public async Task AddAsync(Account account, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(account);

        db.Accounts.Add(account);
        await db.SaveChangesAsync(ct);
    }
}
