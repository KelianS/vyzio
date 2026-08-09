using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

/// <summary>
/// Hands a finished detection over to the notification path without waiting for it (ADR-49).
/// </summary>
public interface IDetectionNotificationQueue
{
    /// <summary>Returns false when the queue is saturated and the detection was dropped.</summary>
    bool TryEnqueue(FrigateDetection detection);

    IAsyncEnumerable<FrigateDetection> ReadAllAsync(CancellationToken ct = default);
}
