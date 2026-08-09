using Microsoft.Extensions.Logging;
using NSubstitute;
using Vyzio.Application.UseCases.Frigate;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Tests.UseCases;

public class IngestFrigateEventUseCaseTests
{
    private readonly IDetectionNotificationQueue _queue = Substitute.For<IDetectionNotificationQueue>();
    private readonly ILogger<IngestFrigateEventUseCase> _logger = Substitute.For<ILogger<IngestFrigateEventUseCase>>();

    public IngestFrigateEventUseCaseTests()
    {
        _queue.TryEnqueue(Arg.Any<FrigateDetection>()).Returns(true);
    }

    [Fact]
    public async Task ExecuteAsync_queues_finished_event_without_notifying_inline()
    {
        var sut = CreateSut(["person"]);

        var processed = await sut.ExecuteAsync("frigate/events", EndPayload("frigate-evt-101", "person"));

        Assert.True(processed);
        // The identity is resolved later, off the handler (ADR-49).
        _queue.Received(1).TryEnqueue(
            Arg.Is<FrigateDetection>(detection =>
                detection.EventId == "frigate-evt-101"
                && detection.Label == "person"
                && detection.Camera == "front_door"
                && detection.Identity == null
                && detection.HasClip
                && detection.HasSnapshot));
    }

    [Theory]
    [InlineData("new")]
    [InlineData("update")]
    public async Task ExecuteAsync_ignores_events_still_in_progress(string lifecycle)
    {
        var sut = CreateSut(["person"]);

        var processed = await sut.ExecuteAsync(
            "frigate/events", EndPayload("frigate-evt-102", "person", lifecycle));

        Assert.False(processed);
        _queue.DidNotReceive().TryEnqueue(Arg.Any<FrigateDetection>());
    }

    [Fact]
    public async Task ExecuteAsync_ignores_filtered_labels()
    {
        var sut = CreateSut(["person"]);

        var processed = await sut.ExecuteAsync("frigate/events", EndPayload("frigate-evt-103", "cat"));

        Assert.False(processed);
        _queue.DidNotReceive().TryEnqueue(Arg.Any<FrigateDetection>());
    }

    [Fact]
    public async Task ExecuteAsync_reports_a_dropped_event_when_the_queue_is_saturated()
    {
        _queue.TryEnqueue(Arg.Any<FrigateDetection>()).Returns(false);
        var sut = CreateSut(["person"]);

        var processed = await sut.ExecuteAsync("frigate/events", EndPayload("frigate-evt-104", "person"));

        Assert.False(processed);
    }

    private IngestFrigateEventUseCase CreateSut(IEnumerable<string> retainedLabels)
        => new(
            new FrigateEventContractAdapter(new FrigateLabelFilter(retainedLabels)),
            _queue,
            _logger);

    private static string EndPayload(
        string eventId,
        string label,
        string lifecycle = "end",
        bool hasClip = true,
        bool hasSnapshot = true)
        => $$"""
        {
          "type": "{{lifecycle}}",
          "after": {
            "id": "{{eventId}}",
            "camera": "front_door",
            "label": "{{label}}",
            "top_score": 0.97,
            "start_time": 1715353200,
            "end_time": 1715353260,
            "has_clip": {{hasClip.ToString().ToLowerInvariant()}},
            "has_snapshot": {{hasSnapshot.ToString().ToLowerInvariant()}},
            "entered_zones": ["porch"]
          }
        }
        """;
}
