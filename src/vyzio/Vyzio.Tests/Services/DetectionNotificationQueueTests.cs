using Vyzio.Core.Entities;
using Vyzio.Infrastructure.Services;

namespace Vyzio.Tests.Services;

public class DetectionNotificationQueueTests
{
    [Fact]
    public async Task ReadAllAsync_hands_back_the_detections_in_order()
    {
        var queue = new DetectionNotificationQueue();
        Assert.True(queue.TryEnqueue(Detection("evt-1")));
        Assert.True(queue.TryEnqueue(Detection("evt-2")));

        var read = new List<string>();

        await foreach (var detection in queue.ReadAllAsync())
        {
            read.Add(detection.EventId);
            if (read.Count == 2) break;
        }

        Assert.Equal(["evt-1", "evt-2"], read);
    }

    [Fact]
    public void TryEnqueue_reports_a_drop_once_saturated()
    {
        var queue = new DetectionNotificationQueue();

        // Capacity is 100: a notification queued behind that many is already too late to send.
        for (var i = 0; i < 100; i++)
        {
            Assert.True(queue.TryEnqueue(Detection($"evt-{i}")));
        }

        Assert.False(queue.TryEnqueue(Detection("evt-overflow")));
    }

    private static FrigateDetection Detection(string eventId)
        => new(eventId, "front_door", "person", Identity: null, 0.9f,
            DateTimeOffset.UtcNow, HasClip: true, HasSnapshot: true);
}
