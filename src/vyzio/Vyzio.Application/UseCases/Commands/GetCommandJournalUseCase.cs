using Vyzio.Application.DTOs.Notifications;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Commands;

/// <summary>
/// The trace of what a channel was asked, and how it ended (SPECS 5.4). Rejected commands are in it:
/// they are the only sign that someone other than the paired conversation is knocking (ADR-50).
/// </summary>
public sealed class GetCommandJournalUseCase(
    ICommandJournalRepository journal,
    IRemoteCommandRegistry registry)
{
    public async Task<IReadOnlyList<CommandJournalEntryDto>> ExecuteAsync(
        NotificationChannel channel,
        int limit = 20,
        CancellationToken ct = default)
    {
        var entries = await journal.GetRecentAsync(channel, limit, ct);
        return entries.Select(entry => CommandJournalEntryDto.From(entry, registry)).ToList();
    }
}
