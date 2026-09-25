using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;
using NSubstitute;
using Vyzio.Application.Services;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Tests.Services;

public class CameraAccountWatchTests
{
    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly IFrigateStatsProvider _stats = Substitute.For<IFrigateStatsProvider>();
    private readonly IRtspAccountProbe _probe = Substitute.For<IRtspAccountProbe>();
    private readonly IFrigateConfigApplier _frigateConfig = Substitute.For<IFrigateConfigApplier>();
    private readonly FakeTimeProvider _time = new(DateTimeOffset.Parse("2026-09-25T10:00:00+00:00", System.Globalization.CultureInfo.InvariantCulture));
    private readonly CameraOutageTracker _tracker = new();
    private readonly Camera _camera = new()
    {
        Id = "cam1",
        Slug = "salon",
        FrigateCameraName = "salon",
        DisplayName = "Salon",
        Host = "192.168.1.10",
        IsEnabled = true,
        ValidationState = "validated",
    };

    public CameraAccountWatchTests()
    {
        _cameras.GetAllAsync(Arg.Any<CancellationToken>()).Returns([_camera]);
        _frigateConfig.ApplyAsync(Arg.Any<IReadOnlyList<Camera>>(), Arg.Any<CancellationToken>())
            .Returns(new FrigateConfigApplyResult(true, "ok", "frigate.yml"));
    }

    private CameraAccountWatch Watch() => new(_cameras, _stats, _probe, _frigateConfig, _time, NullLogger<CameraAccountWatch>.Instance);

    private async Task ReadWithFps(double fps)
    {
        _stats.TryGetStatsAsync(Arg.Any<CancellationToken>()).Returns(new FrigateStats(null, [new CameraFps("salon", fps, 0)]));
        await Watch().ReadAsync(_tracker, CancellationToken.None);
    }

    [Fact]
    public async Task ReadAsync_ShouldProbeOnceAfterTwoSilentReadings_WhenTheCaptureStaysDark()
    {
        _probe.CheckAsync(_camera, Arg.Any<CancellationToken>()).Returns(RtspAccountCheck.NoAnswer);

        await ReadWithFps(0);
        await _probe.DidNotReceive().CheckAsync(Arg.Any<Camera>(), Arg.Any<CancellationToken>());

        await ReadWithFps(0);
        await ReadWithFps(0);
        await _probe.Received(1).CheckAsync(_camera, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ReadAsync_ShouldTakeTheCameraOutOfCapture_WhenItRefusesItsAccount()
    {
        _probe.CheckAsync(_camera, Arg.Any<CancellationToken>()).Returns(RtspAccountCheck.Refused);

        await ReadWithFps(0);
        await ReadWithFps(0);

        Assert.Equal(_time.GetUtcNow(), _camera.AccountRefusedAt);
        await _cameras.Received(1).UpdateAsync(_camera, Arg.Any<CancellationToken>());
        await _frigateConfig.Received(1).ApplyAsync(Arg.Any<IReadOnlyList<Camera>>(), Arg.Any<CancellationToken>());
        await _frigateConfig.DidNotReceive().WriteConfigAsync(Arg.Any<IReadOnlyList<Camera>>(), Arg.Any<bool>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ReadAsync_ShouldReloadOnlyOnceAndOfferTheRestart_WhenTheReloadFailed()
    {
        _probe.CheckAsync(_camera, Arg.Any<CancellationToken>()).Returns(RtspAccountCheck.Refused);
        _frigateConfig.ApplyAsync(Arg.Any<IReadOnlyList<Camera>>(), Arg.Any<CancellationToken>())
            .Returns(new FrigateConfigApplyResult(false, "down", "frigate.yml"));

        await ReadWithFps(0);
        await ReadWithFps(0);
        await ReadWithFps(0);
        await ReadWithFps(0);

        Assert.Equal(_time.GetUtcNow(), _camera.AccountRefusedAt);
        await _probe.Received(1).CheckAsync(_camera, Arg.Any<CancellationToken>());
        await _frigateConfig.Received(1).ApplyAsync(Arg.Any<IReadOnlyList<Camera>>(), Arg.Any<CancellationToken>());
        await _frigateConfig.Received(1).WriteConfigAsync(Arg.Any<IReadOnlyList<Camera>>(), true, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ReadAsync_ShouldChangeNothing_WhenTheOutageIsNotARefusal()
    {
        _probe.CheckAsync(_camera, Arg.Any<CancellationToken>()).Returns(RtspAccountCheck.Accepted);

        await ReadWithFps(0);
        await ReadWithFps(0);

        Assert.Null(_camera.AccountRefusedAt);
        await _cameras.DidNotReceive().UpdateAsync(Arg.Any<Camera>(), Arg.Any<CancellationToken>());
        await _frigateConfig.DidNotReceive().ApplyAsync(Arg.Any<IReadOnlyList<Camera>>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ReadAsync_ShouldProbeAgain_WhenANewOutageFollowsAStreamingSpell()
    {
        _probe.CheckAsync(_camera, Arg.Any<CancellationToken>()).Returns(RtspAccountCheck.NoAnswer);

        await ReadWithFps(0);
        await ReadWithFps(0);
        await ReadWithFps(12);
        await ReadWithFps(0);
        await ReadWithFps(0);

        await _probe.Received(2).CheckAsync(_camera, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ReadAsync_ShouldNeverProbe_WhenTheCameraSpeaksDvrip()
    {
        _camera.StreamProtocol = StreamProtocol.Dvrip;

        await ReadWithFps(0);
        await ReadWithFps(0);

        await _probe.DidNotReceive().CheckAsync(Arg.Any<Camera>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ReadAsync_ShouldStillProbeTheOthers_WhenOneCameraCannotBeProbed()
    {
        var other = new Camera
        {
            Id = "cam2",
            Slug = "garage",
            FrigateCameraName = "garage",
            DisplayName = "Garage",
            Host = "192.168.1.11",
            IsEnabled = true,
            ValidationState = "validated",
        };
        _cameras.GetAllAsync(Arg.Any<CancellationToken>()).Returns([_camera, other]);
        _probe.CheckAsync(_camera, Arg.Any<CancellationToken>()).Returns<RtspAccountCheck>(_ => throw new UriFormatException("bad host"));
        _probe.CheckAsync(other, Arg.Any<CancellationToken>()).Returns(RtspAccountCheck.Refused);
        _stats.TryGetStatsAsync(Arg.Any<CancellationToken>())
            .Returns(new FrigateStats(null, [new CameraFps("salon", 0, 0), new CameraFps("garage", 0, 0)]));

        await Watch().ReadAsync(_tracker, CancellationToken.None);
        await Watch().ReadAsync(_tracker, CancellationToken.None);

        Assert.NotNull(other.AccountRefusedAt);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldKeepCountingAcrossReadings_WhenRunAsAService()
    {
        _probe.CheckAsync(_camera, Arg.Any<CancellationToken>()).Returns(RtspAccountCheck.Refused);
        _stats.TryGetStatsAsync(Arg.Any<CancellationToken>()).Returns(new FrigateStats(null, [new CameraFps("salon", 0, 0)]));
        var refused = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        _cameras.UpdateAsync(_camera, Arg.Any<CancellationToken>()).Returns(_ =>
        {
            refused.TrySetResult();
            return Task.CompletedTask;
        });
        var service = new CameraAccountWatcherService(
            Hosting.BackgroundLoop.Scopes(services => services
                .AddSingleton(_cameras).AddSingleton(_stats).AddSingleton(_probe).AddSingleton(_frigateConfig)
                .AddSingleton<TimeProvider>(_time)
                .AddSingleton(typeof(Microsoft.Extensions.Logging.ILogger<>), typeof(NullLogger<>))
                .AddScoped<CameraAccountWatch>()),
            _time,
            NullLogger<CameraAccountWatcherService>.Instance);

        await service.StartAsync(CancellationToken.None);
        await Hosting.BackgroundLoop.AdvanceUntilAsync(_time, refused.Task, TimeSpan.FromSeconds(30));
        await Hosting.BackgroundLoop.StopWithinGuardAsync(service);

        await _probe.Received(1).CheckAsync(_camera, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ReadAsync_ShouldNeverProbe_WhenTheCameraIsInPrivacyMode()
    {
        _camera.PrivacyModeActive = true;

        await ReadWithFps(0);
        await ReadWithFps(0);

        await _probe.DidNotReceive().CheckAsync(Arg.Any<Camera>(), Arg.Any<CancellationToken>());
    }
}
