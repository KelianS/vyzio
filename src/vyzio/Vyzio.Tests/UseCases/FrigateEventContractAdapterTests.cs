using Vyzio.Application.DTOs.Frigate;
using Vyzio.Application.UseCases.Frigate;

namespace Vyzio.Tests.UseCases;

public class FrigateLabelFilterTests
{
    [Fact]
    public void Allows_all_labels_when_no_filter_is_configured()
    {
        var filter = new FrigateLabelFilter();

        Assert.True(filter.Allows("person"));
        Assert.True(filter.Allows("dog"));
    }

    [Fact]
    public void Allows_only_configured_labels_case_insensitively()
    {
        var filter = new FrigateLabelFilter(["Person", "car"]);

        Assert.True(filter.Allows("person"));
        Assert.True(filter.Allows("CAR"));
        Assert.False(filter.Allows("dog"));
    }
}

public class FrigateEventContractAdapterTests
{
    [Fact]
    public void TryDeserialize_reads_minimal_frigate_event_payload()
    {
        var sut = new FrigateEventContractAdapter(new FrigateLabelFilter(["person"]));
        var payload = """
        {
          "type": "new",
          "after": {
            "id": "frigate-evt-001",
            "camera": "front_door",
            "label": "person",
            "top_score": 0.97,
            "start_time": 1715353200,
            "has_clip": true,
            "has_snapshot": true,
            "entered_zones": ["porch"]
          }
        }
        """;

        var ok = sut.TryDeserialize(payload, out var envelope);

        Assert.True(ok);
        Assert.NotNull(envelope);
        Assert.Equal("new", envelope!.Type);
        Assert.Equal("frigate-evt-001", envelope.After!.Id);
    }

    [Fact]
    public void TryAdapt_projects_relevant_payload_to_consumed_contract()
    {
        var sut = new FrigateEventContractAdapter(new FrigateLabelFilter(["person", "car"]));
        var envelope = new FrigateEventEnvelope(
            "update",
            null,
            new FrigateTrackedObject(
                "frigate-evt-002",
                "driveway",
                "car",
                0.88f,
                1715353200,
                null,
                hasClip: false,
                hasSnapshot: true,
                EnteredZones: ["gate", "driveway"]));

        var ok = sut.TryAdapt(envelope, out var consumedEvent);

        Assert.True(ok);
        Assert.NotNull(consumedEvent);
        Assert.Equal("frigate-evt-002", consumedEvent!.FrigateEventId);
        Assert.Equal("update", consumedEvent.Lifecycle);
        Assert.Equal("driveway", consumedEvent.Camera);
        Assert.Equal("car", consumedEvent.Label);
        Assert.Equal(0.88f, consumedEvent.Confidence);
        Assert.Equal(["gate", "driveway"], consumedEvent.EnteredZones);
        Assert.True(consumedEvent.HasSnapshot);
        Assert.False(consumedEvent.HasClip);
    }

    [Fact]
    public void TryParseRelevantEvent_rejects_labels_outside_runtime_filter()
    {
        var sut = new FrigateEventContractAdapter(new FrigateLabelFilter(["person"]));
        var payload = """
        {
          "type": "new",
          "after": {
            "id": "frigate-evt-003",
            "camera": "garden",
            "label": "cat",
            "top_score": 0.62,
            "start_time": 1715353200,
            "has_clip": false,
            "has_snapshot": true
          }
        }
        """;

        var ok = sut.TryParseRelevantEvent(payload, out var consumedEvent);

        Assert.False(ok);
        Assert.Null(consumedEvent);
    }

    [Fact]
    public void TryAdapt_rejects_unsupported_frigate_event_types()
    {
        var sut = new FrigateEventContractAdapter(new FrigateLabelFilter(["person"]));
        var envelope = new FrigateEventEnvelope(
            "audio",
            null,
            new FrigateTrackedObject(
                "frigate-evt-004",
                "front_door",
                "person",
                0.72f,
                1715353200,
                null,
                hasClip: false,
                hasSnapshot: false,
                EnteredZones: null));

        var ok = sut.TryAdapt(envelope, out var consumedEvent);

        Assert.False(ok);
        Assert.Null(consumedEvent);
    }
}