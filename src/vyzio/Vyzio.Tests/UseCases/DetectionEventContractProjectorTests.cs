using Vyzio.Application.UseCases.DetectionEvents;
using Vyzio.Core.Entities;

namespace Vyzio.Tests.UseCases;

public class DetectionEventContractProjectorTests
{
    private readonly DetectionEventContractProjector _sut = new();

    [Fact]
    public void ToContract_projects_only_the_internal_mvp_detection_fields()
    {
        var detectionEvent = new DetectionEvent
        {
            Id = "evt-001",
            FrigateEventId = "frigate-evt-001",
            Lifecycle = "update",
            Camera = "front_door",
            Label = "person",
            Identity = "Alice",
            ProfileId = "profile-123",
            Confidence = 0.98f,
            OccurredAt = DateTimeOffset.Parse("2026-05-10T10:15:00+00:00"),
            HasClip = true,
            HasSnapshot = false,
            Profile = new Profile { Name = "Resident" }
        };

        var contract = _sut.ToContract(detectionEvent);

        Assert.Equal("evt-001", contract.EventId);
        Assert.Equal("frigate-evt-001", contract.FrigateEventId);
        Assert.Equal("update", contract.Lifecycle);
        Assert.Equal("front_door", contract.Camera);
        Assert.Equal("person", contract.Label);
        Assert.Equal("Alice", contract.Identity);
        Assert.Equal("profile-123", contract.ProfileId);
        Assert.Equal(0.98f, contract.Confidence);
        Assert.Equal(DateTimeOffset.Parse("2026-05-10T10:15:00+00:00"), contract.OccurredAt);
        Assert.True(contract.HasClip);
        Assert.False(contract.HasSnapshot);
    }

    [Fact]
    public void ToContracts_preserves_event_order_for_downstream_consumers()
    {
        var contracts = _sut.ToContracts(
        [
            new DetectionEvent
            {
                Id = "evt-001",
                FrigateEventId = "frigate-evt-001",
                Lifecycle = "new",
                Camera = "front_door",
                Label = "person"
            },
            new DetectionEvent
            {
                Id = "evt-002",
                FrigateEventId = "frigate-evt-002",
                Lifecycle = "end",
                Camera = "garage",
                Label = "car"
            }
        ]);

        Assert.Collection(
            contracts,
            first =>
            {
                Assert.Equal("evt-001", first.EventId);
                Assert.Equal("front_door", first.Camera);
            },
            second =>
            {
                Assert.Equal("evt-002", second.EventId);
                Assert.Equal("garage", second.Camera);
            });
    }
}