using Microsoft.Extensions.Logging;
using NSubstitute;
using Vyzio.Api.Integration.Frigate;
using Vyzio.Application.UseCases.Frigate;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Tests.UseCases;

public class FrigateAdapterTests
{
    private readonly IDetectionEventRepository _detectionEvents = Substitute.For<IDetectionEventRepository>();
    private readonly IFrigateRestClient _restClient = Substitute.For<IFrigateRestClient>();
    private readonly ILogger<FrigateAdapter> _logger = Substitute.For<ILogger<FrigateAdapter>>();

    [Fact]
    public async Task ProcessMessageAsync_adds_relevant_frigate_event_and_enriches_identity()
    {
        var sut = CreateSut(["person"]);
        _restClient.TryGetIdentityAsync("frigate-evt-101", Arg.Any<CancellationToken>())
            .Returns("Alice");

        var processed = await sut.ProcessMessageAsync("frigate/events", RelevantPayload("frigate-evt-101", "person"));

        Assert.True(processed);
        await _detectionEvents.Received(1).AddAsync(
            Arg.Is<DetectionEvent>(evt =>
                evt.FrigateEventId == "frigate-evt-101"
                && evt.Label == "person"
                && evt.Camera == "front_door"
                && evt.Lifecycle == "new"
                && evt.Identity == "Alice"
                && evt.HasClip
                && evt.HasSnapshot),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ProcessMessageAsync_updates_existing_event_without_creating_duplicate()
    {
        var sut = CreateSut(["person"]);
        var existing = new DetectionEvent
        {
            FrigateEventId = "frigate-evt-102",
            Lifecycle = "new",
            Camera = "front_door",
            Label = "person"
        };

        _detectionEvents.GetByFrigateEventIdAsync("frigate-evt-102", Arg.Any<CancellationToken>())
            .Returns(existing);
        _restClient.TryGetIdentityAsync("frigate-evt-102", Arg.Any<CancellationToken>())
            .Returns("Bob");

        var processed = await sut.ProcessMessageAsync("frigate/events", RelevantPayload("frigate-evt-102", "person", lifecycle: "update", hasClip: false));

        Assert.True(processed);
        await _detectionEvents.Received(1).UpdateAsync(
            Arg.Is<DetectionEvent>(evt =>
                evt.FrigateEventId == "frigate-evt-102"
                && evt.Lifecycle == "update"
                && evt.Identity == "Bob"
                && !evt.HasClip
                && evt.HasSnapshot),
            Arg.Any<CancellationToken>());
        await _detectionEvents.DidNotReceive().AddAsync(Arg.Any<DetectionEvent>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ProcessMessageAsync_ignores_filtered_labels()
    {
        var sut = CreateSut(["person"]);

        var processed = await sut.ProcessMessageAsync("frigate/events", RelevantPayload("frigate-evt-103", "cat"));

        Assert.False(processed);
        await _detectionEvents.DidNotReceive().GetByFrigateEventIdAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
        await _detectionEvents.DidNotReceive().AddAsync(Arg.Any<DetectionEvent>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ProcessMessageAsync_keeps_mqtt_payload_when_rest_enrichment_fails()
    {
        var sut = CreateSut(["person"]);
        _restClient.TryGetIdentityAsync("frigate-evt-104", Arg.Any<CancellationToken>())
            .Returns(Task.FromException<string?>(new HttpRequestException("Frigate unavailable")));

        var processed = await sut.ProcessMessageAsync("frigate/events", RelevantPayload("frigate-evt-104", "person"));

        Assert.True(processed);
        await _detectionEvents.Received(1).AddAsync(
            Arg.Is<DetectionEvent>(evt => evt.FrigateEventId == "frigate-evt-104" && evt.Identity == null),
            Arg.Any<CancellationToken>());
    }

    private FrigateAdapter CreateSut(IEnumerable<string> retainedLabels)
        => new(
            new FrigateEventContractAdapter(new FrigateLabelFilter(retainedLabels)),
            _detectionEvents,
            _restClient,
            _logger);

    private static string RelevantPayload(
        string eventId,
        string label,
        string lifecycle = "new",
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
            "has_clip": {{hasClip.ToString().ToLowerInvariant()}},
            "has_snapshot": {{hasSnapshot.ToString().ToLowerInvariant()}},
            "entered_zones": ["porch"]
          }
        }
        """;
}