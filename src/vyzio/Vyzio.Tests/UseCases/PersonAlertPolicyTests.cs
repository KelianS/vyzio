using NSubstitute;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Application.UseCases.DetectionEvents;
using Vyzio.Application.UseCases.Notifications;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Tests.UseCases;

// A person's alert mode and cameras rule whether they are signalled at all (ADR-58).
public class PersonAlertPolicyTests
{
    private readonly IProfileRepository _profiles = Substitute.For<IProfileRepository>();
    private readonly IProfileCameraLinkRepository _links = Substitute.For<IProfileCameraLinkRepository>();
    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly Profile _alice = new() { Name = "Alice" };

    public PersonAlertPolicyTests()
    {
        _profiles.GetAllAsync(Arg.Any<CancellationToken>()).Returns([_alice]);
        _links.GetByProfileIdAsync(_alice.Id, Arg.Any<CancellationToken>()).Returns([]);
        _cameras.GetAllAsync(Arg.Any<CancellationToken>()).Returns([
            Camera("cam-door", "front_door"),
            Camera("cam-garden", "garden"),
        ]);
    }

    private PersonAlertPolicy CreateSut()
        => new(new DetectionProfileResolver(_profiles), _links, new CameraDirectory(_cameras));

    private static Camera Camera(string id, string frigateName) => new()
    {
        Id = id,
        Slug = frigateName,
        DisplayName = frigateName,
        Host = "192.0.2.10",
        FrigateCameraName = frigateName,
    };

    private static FrigateDetection Detection(string? identity, string camera = "garden")
        => new("evt-1", camera, "person", identity, 0.9f, DateTimeOffset.UnixEpoch, false, false);

    private void LinkAliceTo(params string[] cameraIds)
        => _links.GetByProfileIdAsync(_alice.Id, Arg.Any<CancellationToken>())
            .Returns(cameraIds.Select(id => new ProfileCameraLink { ProfileId = _alice.Id, CameraId = id, Enabled = true }).ToList());

    [Fact]
    public async Task DecideAsync_ShouldSignal_WhenTheDetectionNamesNoProfile()
    {
        // Arrange
        var detection = Detection("Mallory");

        // Act
        var decision = await CreateSut().DecideAsync(detection);

        // Assert
        Assert.Equal(PersonAlertDecision.Signalled, decision);
    }

    [Fact]
    public async Task DecideAsync_ShouldNotSignal_WhenThePersonIsSetToNeverBeSignalled()
    {
        // Arrange
        _alice.AlertMode = ProfileAlertMode.Never;

        // Act
        var decision = await CreateSut().DecideAsync(Detection("Alice"));

        // Assert
        Assert.Equal(PersonAlertDecision.NeverSignalled, decision);
    }

    [Fact]
    public async Task DecideAsync_ShouldSignalOnEveryCamera_WhenThePersonHasNoLinkedCamera()
    {
        // Arrange
        var detection = Detection("Alice", camera: "garden");

        // Act
        var decision = await CreateSut().DecideAsync(detection);

        // Assert
        Assert.Equal(PersonAlertDecision.Signalled, decision);
    }

    [Fact]
    public async Task DecideAsync_ShouldSignal_WhenTheDetectionIsOnALinkedCamera()
    {
        // Arrange
        LinkAliceTo("cam-door");

        // Act
        var decision = await CreateSut().DecideAsync(Detection("Alice", camera: "front_door"));

        // Assert
        Assert.Equal(PersonAlertDecision.Signalled, decision);
    }

    [Fact]
    public async Task DecideAsync_ShouldNotSignal_WhenTheDetectionIsOutsideTheLinkedCameras()
    {
        // Arrange
        LinkAliceTo("cam-door");

        // Act
        var decision = await CreateSut().DecideAsync(Detection("Alice", camera: "garden"));

        // Assert
        Assert.Equal(PersonAlertDecision.OutsideTheirCameras, decision);
    }

    [Fact]
    public async Task DecideAsync_ShouldNotSignal_WhenTheCameraIsUnknownAndThePersonIsRestricted()
    {
        // Arrange
        LinkAliceTo("cam-door");

        // Act
        var decision = await CreateSut().DecideAsync(Detection("Alice", camera: "removed_camera"));

        // Assert
        Assert.Equal(PersonAlertDecision.OutsideTheirCameras, decision);
    }

    [Fact]
    public async Task DecideAsync_ShouldSignalOnEveryCamera_WhenEveryLinkOfThePersonIsDisabled()
    {
        // Arrange
        _links.GetByProfileIdAsync(_alice.Id, Arg.Any<CancellationToken>())
            .Returns([new ProfileCameraLink { ProfileId = _alice.Id, CameraId = "cam-door", Enabled = false }]);

        // Act
        var decision = await CreateSut().DecideAsync(Detection("Alice", camera: "garden"));

        // Assert
        Assert.Equal(PersonAlertDecision.Signalled, decision);
    }
}
