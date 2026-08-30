using Microsoft.EntityFrameworkCore;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.Persistence.Repositories;

public sealed class SessionRepository(VyzioDbContext db) : ISessionRepository
{
    public async Task AddAsync(Session session, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(session);

        db.Sessions.Add(session);
        await db.SaveChangesAsync(ct);
    }

    public Task<Session?> GetByTokenHashAsync(string tokenHash, CancellationToken ct = default)
        => db.Sessions.FirstOrDefaultAsync(session => session.TokenHash == tokenHash, ct);

    public async Task UpdateAsync(Session session, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(session);

        db.Sessions.Update(session);
        await db.SaveChangesAsync(ct);
    }

    public async Task<bool> RevokeAsync(string tokenHash, DateTimeOffset now, CancellationToken ct = default)
    {
        var session = await db.Sessions.FirstOrDefaultAsync(candidate => candidate.TokenHash == tokenHash, ct);
        if (session is null || session.RevokedAt is not null) return false;

        session.RevokedAt = now;
        await db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<int> RevokeAllAsync(string accountId, DateTimeOffset now, CancellationToken ct = default)
        => await db.Sessions
            .Where(session => session.AccountId == accountId && session.RevokedAt == null)
            .ExecuteUpdateAsync(setters => setters.SetProperty(session => session.RevokedAt, now), ct);
}
