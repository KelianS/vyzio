using NSubstitute;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Application.UseCases.DetectionEvents;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Tests.UseCases;

public class DetectionEventContractProjectorTests
{
    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly IProfileRepository _profiles = Substitute.For<IProfileRepository>();
    private readonly IProfileCameraLinkRepository _links = Substitute.For<IProfileCameraLinkRepository>();

    private DetectionEventContractProjector CreateSut()
        => new(new CameraDirectory(_cameras), new DetectionProfileResolver(_profiles, _links));

    private static Camera FrontDoor() => new()
    {
        Id = "cam-1",
        Slug = "porte-entree",
        DisplayName = "Porte d'entrée",
        Host = "10.0.0.1",
        FrigateCameraName = "front_door"
    };

    private static FrigateDetection Detection(string eventId, string camera = "front_door", string? identity = null)
        => new(eventId, camera, "person", identity, 0.98f,
            DateTimeOffset.Parse("2026-05-10T10:15:00+00:00"), HasClip: true, HasSnapshot: false);

    [Fact]
    public async Task ToContract_names_the_camera_as_Vyzio_knows_it()
    {
        _cameras.GetAllAsync(Arg.Any<CancellationToken>()).Returns([FrontDoor()]);

        var contract = await CreateSut().ToContractAsync(Detection("frigate-evt-001"));

        Assert.Equal("frigate-evt-001", contract.EventId);
        Assert.Equal("front_door", contract.Camera);
        Assert.Equal("Porte d'entrée", contract.CameraName);
        Assert.Equal(0.98f, contract.Confidence);
        Assert.True(contract.HasClip);
        Assert.False(contract.HasSnapshot);
    }

    [Fact]
    public async Task ToContract_falls_back_to_the_Frigate_name_when_Vyzio_no_longer_knows_the_camera()
    {
        _cameras.GetAllAsync(Arg.Any<CancellationToken>()).Returns([]);

        var contract = await CreateSut().ToContractAsync(Detection("frigate-evt-001", "back_yard"));

        Assert.Equal("back yard", contract.CameraName);
    }

    [Fact]
    public async Task ToContract_resolves_the_profile_at_read_time()
    {
        var profile = new Profile { Name = "Alice" };
        _cameras.GetAllAsync(Arg.Any<CancellationToken>()).Returns([FrontDoor()]);
        _profiles.GetAllAsync(Arg.Any<CancellationToken>()).Returns([profile]);
        _links.GetByProfileIdAsync(profile.Id, Arg.Any<CancellationToken>()).Returns([]);

        var contract = await CreateSut().ToContractAsync(Detection("frigate-evt-001", identity: "Alice"));

        Assert.Equal("Alice", contract.Identity);
        Assert.Equal(profile.Id, contract.ProfileId);
    }

    [Fact]
    public async Task ToContract_leaves_the_profile_unresolved_when_the_camera_is_not_linked_to_it()
    {
        var profile = new Profile { Name = "Alice" };
        _cameras.GetAllAsync(Arg.Any<CancellationToken>()).Returns([FrontDoor()]);
        _profiles.GetAllAsync(Arg.Any<CancellationToken>()).Returns([profile]);
        _links.GetByProfileIdAsync(profile.Id, Arg.Any<CancellationToken>())
            .Returns([new ProfileCameraLink { ProfileId = profile.Id, CameraId = "cam-other", Enabled = true }]);

        var contract = await CreateSut().ToContractAsync(Detection("frigate-evt-001", identity: "Alice"));

        Assert.Equal("Alice", contract.Identity);
        Assert.Null(contract.ProfileId);
    }

    [Fact]
    public async Task ToContracts_preserves_event_order_for_downstream_consumers()
    {
        _cameras.GetAllAsync(Arg.Any<CancellationToken>()).Returns([FrontDoor()]);

        var contracts = await CreateSut().ToContractsAsync(
        [
            Detection("frigate-evt-001"),
            Detection("frigate-evt-002", "garage")
        ]);

        Assert.Collection(
            contracts,
            first =>
            {
                Assert.Equal("frigate-evt-001", first.EventId);
                Assert.Equal("front_door", first.Camera);
            },
            second =>
            {
                Assert.Equal("frigate-evt-002", second.EventId);
                Assert.Equal("garage", second.Camera);
            });
    }
}
