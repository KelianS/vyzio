using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.Services;

internal sealed class ErasedDetections : IErasedDetections
{
    // As many as the notification queue holds: an older erasure has no notification left to stop.
    private const int Capacity = DetectionNotificationQueue.Capacity;

    private readonly Lock _gate = new();
    private readonly Queue<string> _order = new();
    private readonly HashSet<string> _ids = new(StringComparer.Ordinal);

    public void Remember(string frigateEventId)
    {
        lock (_gate)
        {
            if (!_ids.Add(frigateEventId))
                return;

            _order.Enqueue(frigateEventId);
            if (_order.Count > Capacity)
                _ids.Remove(_order.Dequeue());
        }
    }

    public bool Contains(string frigateEventId)
    {
        lock (_gate)
        {
            return _ids.Contains(frigateEventId);
        }
    }
}
