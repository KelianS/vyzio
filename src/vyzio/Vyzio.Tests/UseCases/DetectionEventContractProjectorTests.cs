using System.Globalization;
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
    private readonly IRecordingSettingsRepository _recordingSettings = Substitute.For<IRecordingSettingsRepository>();

    private DetectionEventContractProjector CreateSut(int eventClipDays = 14)
    {
        _recordingSettings.GetAsync(Arg.Any<CancellationToken>())
            .Returns(new RecordingSettings { EventClipDays = eventClipDays });

        return new DetectionEventContractProjector(
            new CameraDirectory(_cameras),
            new DetectionProfileResolver(_profiles, _links),
            _recordingSettings);
    }

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
            DateTimeOffset.Parse("2026-05-10T10:15:00+00:00", CultureInfo.InvariantCulture), HasClip: true, HasSnapshot: false);

    [Fact]
    public async Task ToContractAsync_ShouldNameTheCameraAsVyzioKnowsIt_WhenTheCameraIsKnown()
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
    public async Task ToContractAsync_ShouldFallBackToTheFrigateName_WhenVyzioNoLongerKnowsTheCamera()
    {
        _cameras.GetAllAsync(Arg.Any<CancellationToken>()).Returns([]);

        var contract = await CreateSut().ToContractAsync(Detection("frigate-evt-001", "back_yard"));

        Assert.Equal("back yard", contract.CameraName);
    }

    [Fact]
    public async Task ToContractAsync_ShouldResolveTheProfileAtReadTime_WhenTheIdentityMatchesAProfileWithoutCameraLinks()
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
    public async Task ToContractAsync_ShouldLeaveTheProfileUnresolved_WhenTheCameraIsNotLinkedToIt()
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
    public async Task ToContractAsync_ShouldMarkTheMediaExpired_WhenItIsOlderThanWhatTheCameraKeeps()
    {
        _cameras.GetAllAsync(Arg.Any<CancellationToken>()).Returns([FrontDoor()]);
        var detection = Detection("frigate-evt-001") with { OccurredAt = DateTimeOffset.UtcNow.AddDays(-20) };

        var contract = await CreateSut(eventClipDays: 14).ToContractAsync(detection);

        Assert.True(contract.MediaExpired);
    }

    [Fact]
    public async Task ToContractAsync_ShouldKeepTheMediaAlive_WhenTheCameraOwnDurationStillCoversIt()
    {
        var camera = FrontDoor();
        // The camera keeps longer than the installation: the expiry follows what applies to it.
        camera.EventClipDaysOverride = 30;
        _cameras.GetAllAsync(Arg.Any<CancellationToken>()).Returns([camera]);
        var detection = Detection("frigate-evt-001") with { OccurredAt = DateTimeOffset.UtcNow.AddDays(-20) };

        var contract = await CreateSut(eventClipDays: 14).ToContractAsync(detection);

        Assert.False(contract.MediaExpired);
    }

    [Fact]
    public async Task ToContractsAsync_ShouldPreserveTheEventOrder_WhenProjectingSeveralDetections()
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
