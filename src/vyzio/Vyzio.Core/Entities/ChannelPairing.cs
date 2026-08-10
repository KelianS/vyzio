using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Vyzio.Core.Entities;

/// <summary>Where a pairing stands, as the settings screen and the ingress both read it.</summary>
public enum ChannelPairingState
{
    /// <summary>No conversation can command this channel — the state a revocation returns to.</summary>
    NotPaired,

    /// <summary>A code was issued from the settings and no conversation has claimed it yet.</summary>
    AwaitingConversation,

    /// <summary>The code was never claimed in time; the user starts again.</summary>
    Expired,

    Paired
}

/// <summary>
/// The single conversation allowed to command Vyzio on a channel. One row per channel: pairing another
/// conversation replaces it, revoking deletes it, and every other origin is ignored (ADR-50).
/// </summary>
[Table("channel_pairings")]
public class ChannelPairing
{
    [Key]
    public string Id { get; set; } = Guid.NewGuid().ToString("N");

    [Required]
    public required NotificationChannel Channel { get; set; }

    [MaxLength(100)]
    public string? ConversationId { get; set; }

    [MaxLength(20)]
    public string? PairingCode { get; set; }

    public DateTimeOffset? CodeExpiresAt { get; set; }

    public DateTimeOffset? PairedAt { get; set; }

    public ChannelPairingState StateAt(DateTimeOffset now)
        => ConversationId is not null ? ChannelPairingState.Paired
         : CodeExpiresAt is { } expiry && expiry > now ? ChannelPairingState.AwaitingConversation
         : ChannelPairingState.Expired;

    public bool Accepts(string conversationId)
        => ConversationId is not null && ConversationId == conversationId;

    public bool CodeMatches(string? candidate, DateTimeOffset now)
        => PairingCode is not null
           && CodeExpiresAt is { } expiry && expiry > now
           && string.Equals(PairingCode, candidate?.Trim(), StringComparison.OrdinalIgnoreCase);
}
