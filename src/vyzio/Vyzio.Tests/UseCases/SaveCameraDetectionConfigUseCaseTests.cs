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
    private readonly IRecordingSettingsRepository _recordingSettings = Substitute.For<IRecordingSettingsRepository>();
    private readonly RecordingSettings _installation = new() { ContinuousDays = 0, MotionDays = 7, EventClipDays = 14 };
    private readonly SaveCameraDetectionConfigUseCase _sut;

    public SaveCameraDetectionConfigUseCaseTests()
    {
        _publisher
            .TryPublishSensitivityAsync(Arg.Any<string>(), Arg.Any<MotionSensitivity>(), Arg.Any<CancellationToken>())
            .Returns(true);
        _recordingSettings.GetAsync(Arg.Any<CancellationToken>()).Returns(_installation);
        _sut = new SaveCameraDetectionConfigUseCase(_repo, _recordingSettings, _configApplier, _publisher);
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
        bool pinned = false,
        string? detectStreamId = null,
        int? continuousDays = null,
        int? motionDays = null,
        int? eventClipDays = null)
        => new(["person"], sensitivity, pinned, detectStreamId, continuousDays, motionDays, eventClipDays);

    private static CameraStream AddStream(Camera camera, int ordinal, int? width = null, int? height = null)
    {
        var stream = new CameraStream { CameraId = camera.Id, Ordinal = ordinal, Width = width, Height = height };
        camera.Streams.Add(stream);
        return stream;
    }

    // The restart prompt only appears when something genuinely waits, and names the right subject.

    [Fact]
    public async Task A_save_that_changes_nothing_leaves_nothing_waiting_for_a_restart()
    {
        var camera = GivenCamera();
        camera.DetectionLabelsJson = "[\"person\"]";

        await _sut.ExecuteAsync(camera.Id, Request());

        await _configApplier.Received(1).WriteConfigAsync(
            Arg.Any<IReadOnlyList<Camera>>(),
            Arg.Is<IReadOnlyList<SurveillanceChangeScope>>(scopes => scopes.Count == 0),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Changing_only_a_retention_override_names_retention_not_detection()
    {
        var camera = GivenCamera();
        camera.DetectionLabelsJson = "[\"person\"]";

        await _sut.ExecuteAsync(camera.Id, Request(motionDays: 30));

        await _configApplier.Received(1).WriteConfigAsync(
            Arg.Any<IReadOnlyList<Camera>>(),
            Arg.Is<IReadOnlyList<SurveillanceChangeScope>>(scopes =>
                scopes.Count == 1 && scopes[0] == SurveillanceChangeScope.Retention),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Choosing_a_stream_of_this_camera_stores_it_as_the_analysis_source()
    {
        var camera = GivenCamera();
        AddStream(camera, 0, 2304, 1296);
        var sub = AddStream(camera, 1, 640, 360);

        var dto = await _sut.ExecuteAsync(camera.Id, Request(detectStreamId: sub.Id));

        Assert.Equal(sub.Id, camera.DetectStreamId);
        Assert.Equal(sub.Id, dto!.DetectStreamId);
        Assert.Equal(2, dto.Streams.Count);
    }

    [Fact]
    public async Task An_unknown_stream_id_falls_back_to_the_main_stream_rather_than_being_stored()
    {
        var camera = GivenCamera();
        var main = AddStream(camera, 0, 2304, 1296);

        var dto = await _sut.ExecuteAsync(camera.Id, Request(detectStreamId: "gone"));

        Assert.Null(camera.DetectStreamId);
        Assert.Equal(main.Id, dto!.DetectStreamId);
    }

    [Fact]
    public async Task Clearing_the_choice_returns_analysis_to_the_default_light_stream()
    {
        var camera = GivenCamera();
        var main = AddStream(camera, 0);
        var sub = AddStream(camera, 1);
        camera.DetectStreamId = main.Id;

        var dto = await _sut.ExecuteAsync(camera.Id, Request(detectStreamId: null));

        Assert.Null(camera.DetectStreamId);
        Assert.Equal(sub.Id, dto!.DetectStreamId);
    }

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

    // ── Retention overrides (ADR-39) ──

    [Fact]
    public async Task A_camera_without_overrides_follows_the_installation()
    {
        var camera = GivenCamera();

        var dto = await _sut.ExecuteAsync(camera.Id, Request());

        Assert.Null(dto!.Retention.Continuous.Override);
        Assert.Equal(0, dto.Retention.Continuous.Effective);
        Assert.Equal(7, dto.Retention.Motion.Effective);
        Assert.Equal(14, dto.Retention.EventClip.Effective);
        // The inherited value travels too, so the interface can name what a revert returns to.
        Assert.Equal(7, dto.Retention.Motion.Installation);
    }

    [Fact]
    public async Task An_override_wins_over_the_installation_value()
    {
        var camera = GivenCamera();

        var dto = await _sut.ExecuteAsync(camera.Id, Request(continuousDays: 3, motionDays: 30));

        Assert.Equal(3, camera.ContinuousDaysOverride);
        Assert.Equal(3, dto!.Retention.Continuous.Effective);
        Assert.Equal(30, dto.Retention.Motion.Effective);
        // Untouched, so it still follows the installation rather than freezing today's value.
        Assert.Null(camera.EventClipDaysOverride);
        Assert.Equal(14, dto.Retention.EventClip.Effective);
        // The installation value is unchanged by the override, which is what makes a revert possible.
        Assert.Equal(0, dto.Retention.Continuous.Installation);
    }

    // Zero is an answer, not an absent value — it must not collapse back to the installation.
    [Fact]
    public async Task Zero_days_is_kept_as_an_override_rather_than_read_as_no_choice()
    {
        var camera = GivenCamera();

        var dto = await _sut.ExecuteAsync(camera.Id, Request(motionDays: 0));

        Assert.Equal(0, camera.MotionDaysOverride);
        Assert.Equal(0, dto!.Retention.Motion.Effective);
    }

    [Fact]
    public async Task Clearing_an_override_puts_the_camera_back_on_the_installation()
    {
        var camera = GivenCamera();
        camera.MotionDaysOverride = 30;

        var dto = await _sut.ExecuteAsync(camera.Id, Request(motionDays: null));

        Assert.Null(camera.MotionDaysOverride);
        Assert.Equal(7, dto!.Retention.Motion.Effective);
    }

    [Fact]
    public async Task An_out_of_range_duration_is_clamped_rather_than_failing_the_save()
    {
        var camera = GivenCamera();

        var dto = await _sut.ExecuteAsync(camera.Id, Request(continuousDays: -5, motionDays: 99_999));

        Assert.Equal(0, camera.ContinuousDaysOverride);
        Assert.Equal(RetentionPolicy.MaxDays, camera.MotionDaysOverride);
        Assert.Contains("person", dto!.Labels);
    }

    [Fact]
    public async Task A_camera_that_is_not_live_is_not_pushed_to_frigate()
    {
        var camera = GivenCamera();
        camera.IsEnabled = false;

        await _sut.ExecuteAsync(camera.Id, Request("low", pinned: true));

        await _configApplier.DidNotReceive().WriteConfigAsync(
            Arg.Any<IReadOnlyList<Camera>>(),
            Arg.Any<IReadOnlyList<SurveillanceChangeScope>>(),
            Arg.Any<CancellationToken>());
        await _publisher.DidNotReceive().TryPublishSensitivityAsync(
            Arg.Any<string>(), Arg.Any<MotionSensitivity>(), Arg.Any<CancellationToken>());
    }
}
