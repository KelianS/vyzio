using System.Threading.Channels;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.Services;

internal sealed class DetectionNotificationQueue : IDetectionNotificationQueue
{
    // Bounded: a notification queued behind a hundred others is already too late to send.
    private const int Capacity = 100;

    // Wait mode is what makes TryWrite refuse instead of dropping in silence — the caller says so in the log.
    private readonly Channel<FrigateDetection> _channel = Channel.CreateBounded<FrigateDetection>(
        new BoundedChannelOptions(Capacity)
        {
            FullMode = BoundedChannelFullMode.Wait,
            SingleReader = true
        });

    public bool TryEnqueue(FrigateDetection detection) => _channel.Writer.TryWrite(detection);

    public IAsyncEnumerable<FrigateDetection> ReadAllAsync(CancellationToken ct = default)
        => _channel.Reader.ReadAllAsync(ct);
}
