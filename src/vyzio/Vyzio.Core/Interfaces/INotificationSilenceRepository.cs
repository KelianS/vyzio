using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

public interface INotificationSilenceRepository
{
    /// <summary>The Silence last started, expired or not, or null when none is stored.</summary>
    Task<NotificationSilence?> GetAsync(CancellationToken ct = default);

    /// <summary>Replaces the stored Silence, if any.</summary>
    Task SaveAsync(NotificationSilence silence, CancellationToken ct = default);

    Task ClearAsync(CancellationToken ct = default);
}
