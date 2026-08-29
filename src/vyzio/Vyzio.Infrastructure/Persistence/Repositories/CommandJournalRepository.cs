using Microsoft.EntityFrameworkCore;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.Persistence.Repositories;

public sealed class CommandJournalRepository(VyzioDbContext db) : ICommandJournalRepository
{
    public async Task AddAsync(CommandJournal entry, CancellationToken ct = default)
    {
        db.CommandJournal.Add(entry);
        await db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<CommandJournal>> GetRecentAsync(int limit, CancellationToken ct = default)
        => await db.CommandJournal
            .OrderByDescending(entry => entry.ReceivedAt)
            .Take(limit)
            .ToListAsync(ct);
}
