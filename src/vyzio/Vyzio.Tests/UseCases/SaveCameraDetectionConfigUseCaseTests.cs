using NSubstitute;
using Vyzio.Application.DTOs.Cameras;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Tests.UseCases;

public class SaveCameraDetectionConfigUseCaseTests
{
    private readonly ICameraRepository _repo = Substitute.For<ICameraRepository>();
    private readonly IFrigateConfigApplier _configApplier = Substitute.For<IFrigateConfigApplier>();
    private readonly IFrigateMotionSettingsPublisher _publisher = Substitute.For<IFrigateMotionSettingsPublisher>();
    private readonly SaveCameraDetectionConfigUseCase _sut;

    public SaveCameraDetectionConfigUseCaseTests()
    {
        _publisher
            .TryPublishSensitivityAsync(Arg.Any<string>(), Arg.Any<MotionSensitivity>(), Arg.Any<CancellationToken>())
            .Returns(true);
        _sut = new SaveCameraDetectionConfigUseCase(_repo, _configApplier, _publisher);
    }

    private Camera GivenCamera(MotionSensitivity sensitivity = MotionSensitivity.High, bool pinned = false)
    {
        var camera = new Camera
        {
            Slug = "front-door",
            DisplayName = "Front Door",
            Host = "192.168.1.10",
            Port = 554,
            IsEnabled = true,
            ValidationState = "validated",
            FrigateCameraName = "front_door",
            MotionSensitivity = sensitivity,
            MotionSensitivityPinned = pinned,
        };
        _repo.GetByIdAsync(camera.Id, Arg.Any<CancellationToken>()).Returns(camera);
        _repo.GetAllAsync(Arg.Any<CancellationToken>()).Returns([camera]);
        return camera;
    }

    private static SaveCameraDetectionConfigRequest Request(
        string? sensitivity = null,
        bool pinned = false) => new(["person"], false, sensitivity, pinned);

    [Fact]
    public async Task Pinning_with_a_level_applies_it_immediately_without_a_restart()
    {
        var camera = GivenCamera();

        var dto = await _sut.ExecuteAsync(camera.Id, Request("low", pinned: true));

        Assert.Equal("low", dto!.MotionSensitivity);
        Assert.True(dto.MotionSensitivityPinned);
        Assert.Equal(MotionSensitivity.Low, camera.MotionSensitivity);
        await _publisher.Received(1).TryPublishSensitivityAsync(
            "front_door", MotionSensitivity.Low, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Level_sent_while_unpinned_is_ignored_since_the_loop_owns_it()
    {
        var camera = GivenCamera(MotionSensitivity.High);

        await _sut.ExecuteAsync(camera.Id, Request("low", pinned: false));

        Assert.Equal(MotionSensitivity.High, camera.MotionSensitivity);
        await _publisher.DidNotReceive().TryPublishSensitivityAsync(
            Arg.Any<string>(), Arg.Any<MotionSensitivity>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Unpinning_hands_the_level_back_to_the_loop_without_changing_it()
    {
        var camera = GivenCamera(MotionSensitivity.Medium, pinned: true);

        var dto = await _sut.ExecuteAsync(camera.Id, Request(pinned: false));

        Assert.False(dto!.MotionSensitivityPinned);
        Assert.Equal(MotionSensitivity.Medium, camera.MotionSensitivity);
    }

    [Fact]
    public async Task Re_sending_the_current_level_does_not_republish()
    {
        var camera = GivenCamera(MotionSensitivity.Low, pinned: true);

        await _sut.ExecuteAsync(camera.Id, Request("low", pinned: true));

        await _publisher.DidNotReceive().TryPublishSensitivityAsync(
            Arg.Any<string>(), Arg.Any<MotionSensitivity>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task An_unrecognised_level_is_ignored_rather_than_failing_the_save()
    {
        var camera = GivenCamera(MotionSensitivity.High);

        var dto = await _sut.ExecuteAsync(camera.Id, Request("extreme", pinned: true));

        Assert.NotNull(dto);
        Assert.Equal(MotionSensitivity.High, camera.MotionSensitivity);
        Assert.Contains("person", dto.Labels);
    }

    [Fact]
    public async Task A_camera_that_is_not_live_is_not_pushed_to_frigate()
    {
        var camera = GivenCamera();
        camera.IsEnabled = false;

        await _sut.ExecuteAsync(camera.Id, Request("low", pinned: true));

        await _configApplier.DidNotReceive().WriteConfigAsync(
            Arg.Any<IReadOnlyList<Camera>>(), Arg.Any<CancellationToken>());
        await _publisher.DidNotReceive().TryPublishSensitivityAsync(
            Arg.Any<string>(), Arg.Any<MotionSensitivity>(), Arg.Any<CancellationToken>());
    }
}
