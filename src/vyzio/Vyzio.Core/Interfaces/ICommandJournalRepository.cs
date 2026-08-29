using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

public interface ICommandJournalRepository
{
    Task AddAsync(CommandJournal entry, CancellationToken ct = default);

    /// <summary>Most recent first; a null channel takes them all.</summary>
    Task<IReadOnlyList<CommandJournal>> GetRecentAsync(
        NotificationChannel? channel,
        int limit,
        CancellationToken ct = default);
}
