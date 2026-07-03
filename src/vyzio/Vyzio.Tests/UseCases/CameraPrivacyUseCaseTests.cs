using NSubstitute;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Tests.UseCases;

public class ToggleCameraPrivacyModeUseCaseTests
{
    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly ICameraCapabilityBindingRepository _bindings = Substitute.For<ICameraCapabilityBindingRepository>();
    private readonly ICapabilityProviderRegistry _registry = Substitute.For<ICapabilityProviderRegistry>();
    private readonly IFrigateConfigApplier _frigateConfig = Substitute.For<IFrigateConfigApplier>();
    private readonly IPrivacyCapabilityProvider _privacyProvider = Substitute.For<IPrivacyCapabilityProvider>();
    private readonly IPtzCapabilityProvider _ptzProvider = Substitute.For<IPtzCapabilityProvider>();
    private readonly ToggleCameraPrivacyModeUseCase _sut;

    public ToggleCameraPrivacyModeUseCaseTests()
    {
        _registry.ResolvePrivacy(Arg.Any<CapabilityProtocol>()).Returns(_privacyProvider);
        _registry.ResolvePtz(Arg.Any<CapabilityProtocol>()).Returns(_ptzProvider);
        _cameras.GetAllAsync(Arg.Any<CancellationToken>()).Returns([]);
        _sut = new ToggleCameraPrivacyModeUseCase(_cameras, _bindings, _registry, _frigateConfig);
    }

    private static Camera MakeCamera(string id = "cam1", PrivacyModeStrategy strategy = PrivacyModeStrategy.Software) => new()
    {
        Id = id,
        Slug = id,
        DisplayName = id,
        Host = "192.168.1.10",
        Port = 554,
        PrivacyModeStrategy = strategy,
    };

    private static CameraCapabilityBinding MakeBinding(string cameraId, CameraCapability capability, CapabilityProtocol protocol, bool verified = true) => new()
    {
        CameraId = cameraId,
        Capability = capability,
        Protocol = protocol,
        Verified = verified,
    };

    [Fact]
    public async Task Execute_calls_privacy_provider_and_sets_vendor_cut_when_strategy_is_hardware()
    {
        var camera = MakeCamera(strategy: PrivacyModeStrategy.Hardware);
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        var binding = MakeBinding("cam1", CameraCapability.PrivacyMode, CapabilityProtocol.TapoKlap);
        _bindings.GetAsync("cam1", CameraCapability.PrivacyMode, Arg.Any<CancellationToken>()).Returns(binding);

        var result = await _sut.ExecuteAsync("cam1", active: true);

        Assert.NotNull(result);
        Assert.True(result!.PrivacyVendorCut);
        await _privacyProvider.Received(1).SetPrivacyModeAsync(camera, binding, true, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Execute_leaves_vendor_cut_false_when_strategy_is_software()
    {
        var camera = MakeCamera(strategy: PrivacyModeStrategy.Software);
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);

        var result = await _sut.ExecuteAsync("cam1", active: true);

        Assert.NotNull(result);
        Assert.False(result!.PrivacyVendorCut);
        await _privacyProvider.DidNotReceive().SetPrivacyModeAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<bool>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Execute_leaves_vendor_cut_false_when_hardware_binding_not_verified()
    {
        var camera = MakeCamera(strategy: PrivacyModeStrategy.Hardware);
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetAsync("cam1", CameraCapability.PrivacyMode, Arg.Any<CancellationToken>())
            .Returns(MakeBinding("cam1", CameraCapability.PrivacyMode, CapabilityProtocol.TapoKlap, verified: false));

        var result = await _sut.ExecuteAsync("cam1", active: true);

        Assert.NotNull(result);
        Assert.False(result!.PrivacyVendorCut);
        await _privacyProvider.DidNotReceive().SetPrivacyModeAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<bool>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Execute_ptz_parking_delegates_to_privacy_provider()
    {
        var camera = MakeCamera(strategy: PrivacyModeStrategy.PtzParking);
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        var binding = MakeBinding("cam1", CameraCapability.PrivacyMode, CapabilityProtocol.PtzParking);
        _bindings.GetAsync("cam1", CameraCapability.PrivacyMode, Arg.Any<CancellationToken>()).Returns(binding);

        var result = await _sut.ExecuteAsync("cam1", active: true);

        Assert.NotNull(result);
        Assert.False(result!.PrivacyVendorCut); // no hardware cut for ptz_parking
        await _privacyProvider.Received(1).SetPrivacyModeAsync(camera, binding, true, Arg.Any<CancellationToken>());
        await _frigateConfig.Received(1).ApplyAsync(Arg.Any<IReadOnlyList<Camera>>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Execute_ptz_parking_deactivation_delegates_to_privacy_provider()
    {
        var camera = MakeCamera(strategy: PrivacyModeStrategy.PtzParking);
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        var binding = MakeBinding("cam1", CameraCapability.PrivacyMode, CapabilityProtocol.PtzParking);
        _bindings.GetAsync("cam1", CameraCapability.PrivacyMode, Arg.Any<CancellationToken>()).Returns(binding);

        await _sut.ExecuteAsync("cam1", active: false);

        await _privacyProvider.Received(1).SetPrivacyModeAsync(camera, binding, false, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Execute_ptz_parking_skips_provider_when_no_privacy_binding()
    {
        var camera = MakeCamera(strategy: PrivacyModeStrategy.PtzParking);
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetAsync("cam1", CameraCapability.PrivacyMode, Arg.Any<CancellationToken>())
            .Returns((CameraCapabilityBinding?)null);

        await _sut.ExecuteAsync("cam1", active: true);

        await _privacyProvider.DidNotReceive().SetPrivacyModeAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<bool>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Execute_always_triggers_frigate_reload()
    {
        var camera = MakeCamera();
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);

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
    private readonly ICameraCapabilityBindingRepository _bindings = Substitute.For<ICameraCapabilityBindingRepository>();
    private readonly ICapabilityProviderRegistry _registry = Substitute.For<ICapabilityProviderRegistry>();
    private readonly IFrigateConfigApplier _frigateConfig = Substitute.For<IFrigateConfigApplier>();
    private readonly IPrivacyCapabilityProvider _privacyProvider = Substitute.For<IPrivacyCapabilityProvider>();
    private readonly BatchToggleCameraPrivacyModeUseCase _sut;

    public BatchToggleCameraPrivacyModeUseCaseTests()
    {
        _registry.ResolvePrivacy(Arg.Any<CapabilityProtocol>()).Returns(_privacyProvider);
        _sut = new BatchToggleCameraPrivacyModeUseCase(_cameras, _bindings, _registry, _frigateConfig);
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

        await _sut.ExecuteAsync(["cam1", "cam2"], active: true);

        await _frigateConfig.Received(1).ApplyAsync(Arg.Any<IReadOnlyList<Camera>>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Execute_sets_vendor_cut_for_cameras_with_verified_binding()
    {
        _cameras.GetAllAsync(Arg.Any<CancellationToken>())
            .Returns([MakeCamera("cam1"), MakeCamera("cam2")]);
        _bindings.GetAsync(Arg.Any<string>(), CameraCapability.PrivacyMode, Arg.Any<CancellationToken>())
            .Returns(ci => new CameraCapabilityBinding
            {
                CameraId = ci.ArgAt<string>(0),
                Capability = CameraCapability.PrivacyMode,
                Protocol = CapabilityProtocol.TapoKlap,
                Verified = true,
            });

        var result = await _sut.ExecuteAsync(["cam1", "cam2"], active: true);

        Assert.Equal(2, result.Count);
        Assert.All(result, dto => Assert.True(dto.PrivacyVendorCut));
    }
}

public class SetCameraPrivacyStrategyUseCaseTests
{
    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly SetCameraPrivacyStrategyUseCase _sut;

    public SetCameraPrivacyStrategyUseCaseTests()
    {
        _sut = new SetCameraPrivacyStrategyUseCase(_cameras);
    }

    private static Camera MakeCamera() => new()
    {
        Id = "cam1",
        Slug = "cam1",
        DisplayName = "Test",
        Host = "192.168.1.1",
    };

    [Theory]
    [InlineData("software")]
    [InlineData("ptz_parking")]
    [InlineData("hardware")]
    public async Task Execute_updates_strategy_on_valid_values(string strategy)
    {
        var camera = MakeCamera();
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);

        var result = await _sut.ExecuteAsync("cam1", new SetPrivacyStrategyRequest(strategy));

        Assert.NotNull(result);
        Assert.Equal(strategy, result!.PrivacyModeStrategy);
        var expectedStrategy = Vyzio.Core.Common.SnakeCaseEnum.FromSnakeCase<PrivacyModeStrategy>(strategy);
        await _cameras.Received(1).UpdateAsync(Arg.Is<Camera>(c => c.PrivacyModeStrategy == expectedStrategy), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Execute_throws_on_invalid_strategy()
    {
        await Assert.ThrowsAsync<ArgumentException>(() =>
            _sut.ExecuteAsync("cam1", new SetPrivacyStrategyRequest("invalid_strategy")));
    }

    [Fact]
    public async Task Execute_returns_null_when_camera_not_found()
    {
        _cameras.GetByIdAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns((Camera?)null);

        var result = await _sut.ExecuteAsync("unknown", new SetPrivacyStrategyRequest("software"));

        Assert.Null(result);
    }
}
