using NSubstitute;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Tests.UseCases;

public class ToggleCameraPrivacyModeUseCaseTests
{
    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly ICameraPrivacyRepository _schedules = Substitute.For<ICameraPrivacyRepository>();
    private readonly IVendorCameraAdapterFactory _adapterFactory = Substitute.For<IVendorCameraAdapterFactory>();
    private readonly IFrigateConfigApplier _frigateConfig = Substitute.For<IFrigateConfigApplier>();
    private readonly IVendorCameraAdapter _adapter = Substitute.For<IVendorCameraAdapter>();
    private readonly ToggleCameraPrivacyModeUseCase _sut;

    public ToggleCameraPrivacyModeUseCaseTests()
    {
        _adapterFactory.Resolve(Arg.Any<Camera>()).Returns(_adapter);
        _cameras.GetAllAsync(Arg.Any<CancellationToken>()).Returns([]);
        _sut = new ToggleCameraPrivacyModeUseCase(_cameras, _adapterFactory, _frigateConfig);
    }

    private static Camera MakeCamera(string id = "cam1", string strategy = "software") => new()
    {
        Id = id,
        Slug = id,
        DisplayName = id,
        Host = "192.168.1.10",
        Port = 554,
        PrivacyModeStrategy = strategy,
    };

    [Fact]
    public async Task Execute_calls_vendor_adapter_and_sets_vendor_cut_when_strategy_is_hardware()
    {
        var camera = MakeCamera(strategy: "hardware");
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _adapter.SupportsPrivacyModeAsync(camera, Arg.Any<CancellationToken>()).Returns(true);

        var result = await _sut.ExecuteAsync("cam1", active: true);

        Assert.NotNull(result);
        Assert.True(result!.PrivacyVendorCut);
        await _adapter.Received(1).SetPrivacyModeAsync(camera, true, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Execute_leaves_vendor_cut_false_when_strategy_is_software()
    {
        var camera = MakeCamera(strategy: "software");
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);

        var result = await _sut.ExecuteAsync("cam1", active: true);

        Assert.NotNull(result);
        Assert.False(result!.PrivacyVendorCut);
        await _adapter.DidNotReceive().SetPrivacyModeAsync(Arg.Any<Camera>(), Arg.Any<bool>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Execute_leaves_vendor_cut_false_when_hardware_adapter_not_supported()
    {
        var camera = MakeCamera(strategy: "hardware");
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _adapter.SupportsPrivacyModeAsync(camera, Arg.Any<CancellationToken>()).Returns(false);

        var result = await _sut.ExecuteAsync("cam1", active: true);

        Assert.NotNull(result);
        Assert.False(result!.PrivacyVendorCut);
        await _adapter.DidNotReceive().SetPrivacyModeAsync(Arg.Any<Camera>(), Arg.Any<bool>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Execute_always_triggers_frigate_reload()
    {
        var camera = MakeCamera();
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _adapter.SupportsPrivacyModeAsync(camera, Arg.Any<CancellationToken>()).Returns(false);

        await _sut.ExecuteAsync("cam1", active: true);

        await _frigateConfig.Received(1).ApplyAsync(Arg.Any<IReadOnlyList<Camera>>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Execute_returns_null_when_camera_not_found()
    {
        _cameras.GetByIdAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns((Camera?)null);

        var result = await _sut.ExecuteAsync("unknown", active: true);

        Assert.Null(result);
    }
}

public class BatchToggleCameraPrivacyModeUseCaseTests
{
    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly IVendorCameraAdapterFactory _adapterFactory = Substitute.For<IVendorCameraAdapterFactory>();
    private readonly IFrigateConfigApplier _frigateConfig = Substitute.For<IFrigateConfigApplier>();
    private readonly IVendorCameraAdapter _adapter = Substitute.For<IVendorCameraAdapter>();
    private readonly BatchToggleCameraPrivacyModeUseCase _sut;

    public BatchToggleCameraPrivacyModeUseCaseTests()
    {
        _adapterFactory.Resolve(Arg.Any<Camera>()).Returns(_adapter);
        _sut = new BatchToggleCameraPrivacyModeUseCase(_cameras, _adapterFactory, _frigateConfig);
    }

    private static Camera MakeCamera(string id) => new()
    {
        Id = id,
        Slug = id,
        DisplayName = id,
        Host = "192.168.1.10",
        Port = 554,
    };

    [Fact]
    public async Task Execute_triggers_single_frigate_reload_for_entire_batch()
    {
        _cameras.GetAllAsync(Arg.Any<CancellationToken>())
            .Returns([MakeCamera("cam1"), MakeCamera("cam2")]);
        _adapter.SupportsPrivacyModeAsync(Arg.Any<Camera>(), Arg.Any<CancellationToken>()).Returns(false);

        await _sut.ExecuteAsync(["cam1", "cam2"], active: true);

        await _frigateConfig.Received(1).ApplyAsync(Arg.Any<IReadOnlyList<Camera>>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Execute_sets_vendor_cut_for_cameras_with_adapter_support()
    {
        _cameras.GetAllAsync(Arg.Any<CancellationToken>())
            .Returns([MakeCamera("cam1"), MakeCamera("cam2")]);
        _adapter.SupportsPrivacyModeAsync(Arg.Any<Camera>(), Arg.Any<CancellationToken>()).Returns(true);

        var result = await _sut.ExecuteAsync(["cam1", "cam2"], active: true);

        Assert.Equal(2, result.Count);
        Assert.All(result, dto => Assert.True(dto.PrivacyVendorCut));
    }
}
