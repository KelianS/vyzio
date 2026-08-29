using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Vyzio.Core.Entities;

/// <summary>
/// One received command: origin, command, outcome, time. A fact Vyzio alone holds, and the only usable
/// trace should a pairing leak (ADR-50).
/// </summary>
[Table("command_journal")]
public class CommandJournal
{
    [Key]
    public string Id { get; set; } = Guid.NewGuid().ToString("N");

    [Required]
    public required NotificationChannel Channel { get; set; }

    [Required, MaxLength(100)]
    public required string ConversationId { get; set; }

    [Required]
    public required RemoteCommandName Command { get; set; }

    [Required]
    public required CommandOutcome Outcome { get; set; }

    public DateTimeOffset ReceivedAt { get; set; } = DateTimeOffset.UtcNow;

    public string? ErrorMessage { get; set; }
}
