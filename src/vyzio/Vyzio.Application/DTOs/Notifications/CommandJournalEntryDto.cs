using Vyzio.Core.Common;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.DTOs.Notifications;

/// <summary>
/// One line of the command journal. The conversation is not handed back — a rejected command names no
/// stranger, so the trace cannot become a directory of who tried (ADR-50).
/// </summary>
/// <param name="Verb">What the user actually typed, resolved through the registry so the screen never
/// spells a command name of its own.</param>
public sealed record CommandJournalEntryDto(
    string Id,
    string Verb,
    string Outcome,
    DateTimeOffset ReceivedAt,
    string? ErrorMessage)
{
    public static CommandJournalEntryDto From(CommandJournal entry, IRemoteCommandRegistry registry)
    {
        ArgumentNullException.ThrowIfNull(entry);
        ArgumentNullException.ThrowIfNull(registry);

        var verb = registry.Descriptors
            .FirstOrDefault(descriptor => descriptor.Name == entry.Command)?.Verb;

        return new CommandJournalEntryDto(
            entry.Id,
            verb ?? SnakeCaseEnum.ToSnakeCase(entry.Command),
            SnakeCaseEnum.ToSnakeCase(entry.Outcome),
            entry.ReceivedAt,
            entry.ErrorMessage);
    }
}
