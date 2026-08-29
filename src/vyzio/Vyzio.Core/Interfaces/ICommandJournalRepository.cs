using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

public interface ICommandJournalRepository
{
    Task AddAsync(CommandJournal entry, CancellationToken ct = default);

    Task<IReadOnlyList<CommandJournal>> GetRecentAsync(int limit, CancellationToken ct = default);
}
