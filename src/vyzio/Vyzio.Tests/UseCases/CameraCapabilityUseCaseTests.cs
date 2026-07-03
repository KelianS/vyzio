using NSubstitute;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Tests.UseCases;

public class ProbeCameraCapabilityUseCaseTests
{
    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly ICameraCapabilityBindingRepository _bindings = Substitute.For<ICameraCapabilityBindingRepository>();
    private readonly ICapabilityProviderRegistry _registry = Substitute.For<ICapabilityProviderRegistry>();
    private readonly IPtzCapabilityProvider _ptzProvider = Substitute.For<IPtzCapabilityProvider>();
    private readonly IPrivacyCapabilityProvider _privacyProvider = Substitute.For<IPrivacyCapabilityProvider>();
    private readonly ProbeCameraCapabilityUseCase _sut;

    public ProbeCameraCapabilityUseCaseTests()
    {
        _registry.ResolvePtz(Arg.Any<CapabilityProtocol>()).Returns(_ptzProvider);
        _registry.ResolvePrivacy(Arg.Any<CapabilityProtocol>()).Returns(_privacyProvider);
        _sut = new ProbeCameraCapabilityUseCase(_cameras, _bindings, _registry);
    }

    private static Camera MakeCamera(string id = "cam1") => new()
    {
        Id = id,
        Slug = id,
        DisplayName = id,
        Host = "192.168.1.10",
    };

    private static CameraCapabilityBinding MakeBinding(CameraCapability capability, CapabilityProtocol protocol = CapabilityProtocol.Onvif) => new()
    {
        CameraId = "cam1",
        Capability = capability,
        Protocol = protocol,
    };

    [Fact]
    public async Task ExecuteAsync_returns_null_when_camera_not_found()
    {
        _cameras.GetByIdAsync("x", Arg.Any<CancellationToken>()).Returns((Camera?)null);

        var result = await _sut.ExecuteAsync("x", CameraCapability.Ptz);

        Assert.Null(result);
    }

    [Fact]
    public async Task ExecuteAsync_returns_null_when_binding_not_found()
    {
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(MakeCamera());
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns((CameraCapabilityBinding?)null);

        var result = await _sut.ExecuteAsync("cam1", CameraCapability.Ptz);

        Assert.Null(result);
    }

    [Fact]
    public async Task ExecuteAsync_sets_verified_true_and_saves_when_probe_succeeds()
    {
        var camera = MakeCamera();
        var binding = MakeBinding(CameraCapability.Ptz);
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns(binding);
        _ptzProvider.ProbeAsync(camera, binding, Arg.Any<CancellationToken>()).Returns(true);

        var result = await _sut.ExecuteAsync("cam1", CameraCapability.Ptz);

        Assert.NotNull(result);
        Assert.True(result!.Verified);
        Assert.Null(result.LastError);
        await _bindings.Received(1).SaveAsync(Arg.Is<CameraCapabilityBinding>(b => b.Verified == true), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_sets_verified_false_and_saves_when_probe_returns_false()
    {
        var camera = MakeCamera();
        var binding = MakeBinding(CameraCapability.Ptz);
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns(binding);
        _ptzProvider.ProbeAsync(camera, binding, Arg.Any<CancellationToken>()).Returns(false);

        var result = await _sut.ExecuteAsync("cam1", CameraCapability.Ptz);

        Assert.NotNull(result);
        Assert.False(result!.Verified);
        await _bindings.Received(1).SaveAsync(Arg.Is<CameraCapabilityBinding>(b => b.Verified == false), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_sets_verified_false_with_error_when_probe_throws()
    {
        var camera = MakeCamera();
        var binding = MakeBinding(CameraCapability.Ptz);
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns(binding);
        _ptzProvider.ProbeAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>())
            .Returns<bool>(_ => throw new InvalidOperationException("connection refused"));

        var result = await _sut.ExecuteAsync("cam1", CameraCapability.Ptz);

        Assert.NotNull(result);
        Assert.False(result!.Verified);
        Assert.Equal("connection refused", result.LastError);
    }

    [Fact]
    public async Task ExecuteAsync_uses_privacy_provider_for_privacy_capability()
    {
        var camera = MakeCamera();
        var binding = MakeBinding(CameraCapability.PrivacyMode, CapabilityProtocol.TapoKlap);
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetAsync("cam1", CameraCapability.PrivacyMode, Arg.Any<CancellationToken>()).Returns(binding);
        _privacyProvider.ProbeAsync(camera, binding, Arg.Any<CancellationToken>()).Returns(true);

        await _sut.ExecuteAsync("cam1", CameraCapability.PrivacyMode);

        await _privacyProvider.Received(1).ProbeAsync(camera, binding, Arg.Any<CancellationToken>());
        await _ptzProvider.DidNotReceive().ProbeAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>());
    }
}

public class ConfigureCameraCapabilityUseCaseTests
{
    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly ICameraCapabilityBindingRepository _bindings = Substitute.For<ICameraCapabilityBindingRepository>();
    private readonly ICapabilityProviderRegistry _registry = Substitute.For<ICapabilityProviderRegistry>();
    private readonly IPtzCapabilityProvider _ptzProvider = Substitute.For<IPtzCapabilityProvider>();
    private readonly ConfigureCameraCapabilityUseCase _sut;

    public ConfigureCameraCapabilityUseCaseTests()
    {
        _registry.ResolvePtz(Arg.Any<CapabilityProtocol>()).Returns(_ptzProvider);
        _ptzProvider.ProbeAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>()).Returns(true);
        var probe = new ProbeCameraCapabilityUseCase(_cameras, _bindings, _registry);
        _sut = new ConfigureCameraCapabilityUseCase(_cameras, _bindings, probe);
    }

    private static Camera MakeCamera() => new()
    {
        Id = "cam1",
        Slug = "cam1",
        DisplayName = "cam1",
        Host = "192.168.1.10",
    };

    [Fact]
    public async Task ExecuteAsync_returns_null_when_camera_not_found()
    {
        _cameras.GetByIdAsync("x", Arg.Any<CancellationToken>()).Returns((Camera?)null);

        var result = await _sut.ExecuteAsync("x", new ConfigureCameraCapabilityRequest("ptz", "onvif", null));

        Assert.Null(result);
    }

    [Fact]
    public async Task ExecuteAsync_throws_on_invalid_capability()
    {
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(MakeCamera());

        await Assert.ThrowsAsync<ArgumentException>(
            () => _sut.ExecuteAsync("cam1", new ConfigureCameraCapabilityRequest("invalid_cap", "onvif", null)));
    }

    [Fact]
    public async Task ExecuteAsync_throws_on_invalid_protocol()
    {
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(MakeCamera());

        await Assert.ThrowsAsync<ArgumentException>(
            () => _sut.ExecuteAsync("cam1", new ConfigureCameraCapabilityRequest("ptz", "not_a_protocol", null)));
    }

    [Fact]
    public async Task ExecuteAsync_creates_binding_saves_then_probes()
    {
        var camera = MakeCamera();
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        // First GetAsync (Configure) → null; second (Probe) → the newly created binding
        var createdBinding = new CameraCapabilityBinding { CameraId = "cam1", Capability = CameraCapability.Ptz, Protocol = CapabilityProtocol.Onvif };
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>())
            .Returns((CameraCapabilityBinding?)null, createdBinding);
        _ptzProvider.ProbeAsync(camera, createdBinding, Arg.Any<CancellationToken>()).Returns(true);

        var result = await _sut.ExecuteAsync("cam1", new ConfigureCameraCapabilityRequest("ptz", "onvif", null));

        Assert.NotNull(result);
        Assert.Equal("ptz", result!.Capability);
        Assert.Equal("onvif", result.Protocol);
        // SaveAsync called twice: once to create, once to update from probe result
        await _bindings.Received(2).SaveAsync(Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_updates_existing_binding_protocol()
    {
        var camera = MakeCamera();
        var existing = new CameraCapabilityBinding
        {
            CameraId = "cam1",
            Capability = CameraCapability.Ptz,
            Protocol = CapabilityProtocol.Dvrip,
            Verified = true,
        };
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        // Both calls return the same object (it gets mutated in-place by Configure)
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns(existing);

        await _sut.ExecuteAsync("cam1", new ConfigureCameraCapabilityRequest("ptz", "onvif", null));

        // 2 SaveAsync calls: first resets Protocol+Verified, second is from Probe
        await _bindings.Received(2).SaveAsync(Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>());
        // After execution, the binding protocol was changed to Onvif
        Assert.Equal(CapabilityProtocol.Onvif, existing.Protocol);
    }
}

public class GetCameraCapabilitiesUseCaseTests
{
    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly ICameraCapabilityBindingRepository _bindings = Substitute.For<ICameraCapabilityBindingRepository>();
    private readonly GetCameraCapabilitiesUseCase _sut;

    public GetCameraCapabilitiesUseCaseTests()
    {
        _sut = new GetCameraCapabilitiesUseCase(_cameras, _bindings);
    }

    [Fact]
    public async Task ExecuteAsync_returns_null_when_camera_not_found()
    {
        _cameras.GetByIdAsync("x", Arg.Any<CancellationToken>()).Returns((Camera?)null);

        var result = await _sut.ExecuteAsync("x");

        Assert.Null(result);
    }

    [Fact]
    public async Task ExecuteAsync_returns_empty_list_when_no_bindings()
    {
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(new Camera { Id = "cam1", Slug = "cam1", DisplayName = "cam1", Host = "h" });
        _bindings.GetByCameraAsync("cam1", Arg.Any<CancellationToken>()).Returns([]);

        var result = await _sut.ExecuteAsync("cam1");

        Assert.NotNull(result);
        Assert.Empty(result!);
    }

    [Fact]
    public async Task ExecuteAsync_maps_bindings_to_dtos()
    {
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(new Camera { Id = "cam1", Slug = "cam1", DisplayName = "cam1", Host = "h" });
        _bindings.GetByCameraAsync("cam1", Arg.Any<CancellationToken>()).Returns([
            new CameraCapabilityBinding { CameraId = "cam1", Capability = CameraCapability.Ptz, Protocol = CapabilityProtocol.Onvif, Verified = true },
            new CameraCapabilityBinding { CameraId = "cam1", Capability = CameraCapability.PrivacyMode, Protocol = CapabilityProtocol.TapoKlap, Verified = false },
        ]);

        var result = await _sut.ExecuteAsync("cam1");

        Assert.Equal(2, result!.Count);
        Assert.Contains(result, b => b.Capability == "ptz" && b.Protocol == "onvif" && b.Verified);
        Assert.Contains(result, b => b.Capability == "privacy_mode" && b.Protocol == "tapo_klap" && !b.Verified);
    }
}
