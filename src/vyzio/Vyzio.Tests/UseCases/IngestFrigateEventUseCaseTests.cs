using Microsoft.Extensions.Logging;
using NSubstitute;
using Vyzio.Application.UseCases.Frigate;
using Vyzio.Application.UseCases.Notifications;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Tests.UseCases;

public class IngestFrigateEventUseCaseTests
{
    private readonly IDetectionNotificationDispatcher _notifications = Substitute.For<IDetectionNotificationDispatcher>();
    private readonly IFrigateEventReader _eventReader = Substitute.For<IFrigateEventReader>();
    private readonly ILogger<IngestFrigateEventUseCase> _logger = Substitute.For<ILogger<IngestFrigateEventUseCase>>();

    [Fact]
    public async Task ExecuteAsync_dispatches_finished_event_and_enriches_identity()
    {
        var sut = CreateSut(["person"]);
        _eventReader.TryGetIdentityAsync("frigate-evt-101", Arg.Any<CancellationToken>())
            .Returns("Alice");

        var processed = await sut.ExecuteAsync("frigate/events", EndPayload("frigate-evt-101", "person"));

        Assert.True(processed);
        await _notifications.Received(1).ExecuteAsync(
            Arg.Is<FrigateDetection>(detection =>
                detection.EventId == "frigate-evt-101"
                && detection.Label == "person"
                && detection.Camera == "front_door"
                && detection.Identity == "Alice"
                && detection.HasClip
                && detection.HasSnapshot),
            Arg.Any<CancellationToken>());
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
        await _notifications.DidNotReceive().ExecuteAsync(
            Arg.Any<FrigateDetection>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ignores_filtered_labels()
    {
        var sut = CreateSut(["person"]);

        var processed = await sut.ExecuteAsync("frigate/events", EndPayload("frigate-evt-103", "cat"));

        Assert.False(processed);
        await _notifications.DidNotReceive().ExecuteAsync(
            Arg.Any<FrigateDetection>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_keeps_mqtt_payload_when_rest_enrichment_fails()
    {
        var sut = CreateSut(["person"]);
        _eventReader.TryGetIdentityAsync("frigate-evt-104", Arg.Any<CancellationToken>())
            .Returns(Task.FromException<string?>(new HttpRequestException("Frigate unavailable")));

        var processed = await sut.ExecuteAsync("frigate/events", EndPayload("frigate-evt-104", "person"));

        Assert.True(processed);
        await _notifications.Received(1).ExecuteAsync(
            Arg.Is<FrigateDetection>(detection =>
                detection.EventId == "frigate-evt-104" && detection.Identity == null),
            Arg.Any<CancellationToken>());
    }

    private IngestFrigateEventUseCase CreateSut(IEnumerable<string> retainedLabels)
        => new(
            new FrigateEventContractAdapter(new FrigateLabelFilter(retainedLabels)),
            _notifications,
            _eventReader,
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
