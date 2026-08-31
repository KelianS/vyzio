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
    private readonly IImageSettingsCapabilityProvider _imageSettingsProvider = Substitute.For<IImageSettingsCapabilityProvider>();
    private readonly ProbeCameraCapabilityUseCase _sut;

    public ProbeCameraCapabilityUseCaseTests()
    {
        _registry.ResolvePtz(Arg.Any<SupportedProtocol>()).Returns(_ptzProvider);
        _registry.ResolvePrivacy(Arg.Any<SupportedProtocol>()).Returns(_privacyProvider);
        _registry.ResolveImageSettings(Arg.Any<SupportedProtocol>()).Returns(_imageSettingsProvider);
        _sut = new ProbeCameraCapabilityUseCase(_cameras, _bindings, _registry);
    }

    private static Camera MakeCamera(string id = "cam1") => new()
    {
        Id = id,
        Slug = id,
        FrigateCameraName = id.Replace('-', '_'),
        DisplayName = id,
        Host = "192.168.1.10",
    };

    private static CameraCapabilityBinding MakeBinding(CameraCapability capability, SupportedProtocol protocol = SupportedProtocol.Onvif) => new()
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
    public async Task A_protocol_that_passes_its_probe_is_recorded_as_supported()
    {
        var camera = MakeCamera();
        var binding = MakeBinding(CameraCapability.ImageSettings, SupportedProtocol.Dvrip);
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetAsync("cam1", CameraCapability.ImageSettings, Arg.Any<CancellationToken>()).Returns(binding);
        _imageSettingsProvider.ProbeAsync(camera, binding, Arg.Any<CancellationToken>()).Returns(true);

        await _sut.ExecuteAsync("cam1", CameraCapability.ImageSettings);

        Assert.Contains(SupportedProtocol.Dvrip, camera.GetSupportedProtocols());
        await _cameras.Received(1).UpdateAsync(camera, Arg.Any<CancellationToken>());
    }

    // The cascade tries candidates until one answers; a candidate that failed proves nothing about
    // the camera and must not end up in the list (ADR-28).
    [Fact]
    public async Task A_protocol_that_fails_its_probe_is_not_recorded()
    {
        var camera = MakeCamera();
        var binding = MakeBinding(CameraCapability.ImageSettings, SupportedProtocol.Onvif);
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetAsync("cam1", CameraCapability.ImageSettings, Arg.Any<CancellationToken>()).Returns(binding);
        _imageSettingsProvider.ProbeAsync(camera, binding, Arg.Any<CancellationToken>()).Returns(false);

        await _sut.ExecuteAsync("cam1", CameraCapability.ImageSettings);

        Assert.Empty(camera.GetSupportedProtocols());
        await _cameras.DidNotReceive().UpdateAsync(Arg.Any<Camera>(), Arg.Any<CancellationToken>());
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
    public async Task ExecuteAsync_uses_privacy_provider_for_hardware_privacy_capability()
    {
        var camera = MakeCamera();
        var binding = MakeBinding(CameraCapability.HardwarePrivacy, SupportedProtocol.TapoKlap);
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetAsync("cam1", CameraCapability.HardwarePrivacy, Arg.Any<CancellationToken>()).Returns(binding);
        _privacyProvider.ProbeAsync(camera, binding, Arg.Any<CancellationToken>()).Returns(true);

        await _sut.ExecuteAsync("cam1", CameraCapability.HardwarePrivacy);

        await _privacyProvider.Received(1).ProbeAsync(camera, binding, Arg.Any<CancellationToken>());
        await _ptzProvider.DidNotReceive().ProbeAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_uses_image_settings_provider_for_image_settings_capability()
    {
        var camera = MakeCamera();
        var binding = MakeBinding(CameraCapability.ImageSettings, SupportedProtocol.Onvif);
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetAsync("cam1", CameraCapability.ImageSettings, Arg.Any<CancellationToken>()).Returns(binding);
        _imageSettingsProvider.ProbeAsync(camera, binding, Arg.Any<CancellationToken>()).Returns(true);

        var result = await _sut.ExecuteAsync("cam1", CameraCapability.ImageSettings);

        Assert.NotNull(result);
        Assert.True(result!.Verified);
        await _imageSettingsProvider.Received(1).ProbeAsync(camera, binding, Arg.Any<CancellationToken>());
    }

    // ADR-28 follow-up: OnvifImageSettingsProvider now lets OnvifCallException propagate instead
    // of swallowing it — this locks in that the real reason ends up in LastError, not a generic message.
    [Fact]
    public async Task ExecuteAsync_surfaces_real_error_message_when_image_settings_probe_throws()
    {
        var camera = MakeCamera();
        var binding = MakeBinding(CameraCapability.ImageSettings, SupportedProtocol.Onvif);
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetAsync("cam1", CameraCapability.ImageSettings, Arg.Any<CancellationToken>()).Returns(binding);
        _imageSettingsProvider.ProbeAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>())
            .Returns<bool>(_ => throw new InvalidOperationException("La caméra a refusé la requête ONVIF imaging_service (400 Bad Request)."));

        var result = await _sut.ExecuteAsync("cam1", CameraCapability.ImageSettings);

        Assert.NotNull(result);
        Assert.False(result!.Verified);
        Assert.Equal("La caméra a refusé la requête ONVIF imaging_service (400 Bad Request).", result.LastError);
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
        _registry.ResolvePtz(Arg.Any<SupportedProtocol>()).Returns(_ptzProvider);
        _ptzProvider.ProbeAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>()).Returns(true);
        var probe = new ProbeCameraCapabilityUseCase(_cameras, _bindings, _registry);
        _sut = new ConfigureCameraCapabilityUseCase(_cameras, _bindings, probe);
    }

    private static Camera MakeCamera() => new()
    {
        Id = "cam1",
        Slug = "cam1",
        FrigateCameraName = "cam1",
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
        var createdBinding = new CameraCapabilityBinding { CameraId = "cam1", Capability = CameraCapability.Ptz, Protocol = SupportedProtocol.Onvif };
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
            Protocol = SupportedProtocol.Dvrip,
            Verified = true,
        };
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        // Both calls return the same object (it gets mutated in-place by Configure)
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns(existing);

        await _sut.ExecuteAsync("cam1", new ConfigureCameraCapabilityRequest("ptz", "onvif", null));

        // 2 SaveAsync calls: first resets Protocol+Verified, second is from Probe
        await _bindings.Received(2).SaveAsync(Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>());
        // After execution, the binding protocol was changed to Onvif
        Assert.Equal(SupportedProtocol.Onvif, existing.Protocol);
    }
}

public class ProbeCameraCapabilityUseCasePtzSupportedTests
{
    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly ICameraCapabilityBindingRepository _bindings = Substitute.For<ICameraCapabilityBindingRepository>();
    private readonly ICapabilityProviderRegistry _registry = Substitute.For<ICapabilityProviderRegistry>();
    private readonly IPtzCapabilityProvider _ptzProvider = Substitute.For<IPtzCapabilityProvider>();
    private readonly ProbeCameraCapabilityUseCase _sut;

    public ProbeCameraCapabilityUseCasePtzSupportedTests()
    {
        _registry.ResolvePtz(Arg.Any<SupportedProtocol>()).Returns(_ptzProvider);
        _sut = new ProbeCameraCapabilityUseCase(_cameras, _bindings, _registry);
    }

    [Fact]
    public async Task ExecuteAsync_sets_ptz_supported_when_ptz_probe_succeeds()
    {
        var camera = new Camera { Id = "cam1", Slug = "cam1", FrigateCameraName = "cam1", DisplayName = "cam1", Host = "h", PtzSupported = false };
        var binding = new CameraCapabilityBinding { CameraId = "cam1", Capability = CameraCapability.Ptz, Protocol = SupportedProtocol.Onvif };
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns(binding);
        _ptzProvider.ProbeAsync(camera, binding, Arg.Any<CancellationToken>()).Returns(true);

        await _sut.ExecuteAsync("cam1", CameraCapability.Ptz);

        Assert.True(camera.PtzSupported);
        await _cameras.Received(1).UpdateAsync(Arg.Is<Camera>(c => c.PtzSupported), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_does_not_update_camera_when_ptz_already_supported()
    {
        var camera = new Camera { Id = "cam1", Slug = "cam1", FrigateCameraName = "cam1", DisplayName = "cam1", Host = "h", PtzSupported = true };
        // Already proven too, otherwise the probe would legitimately write it (see
        // A_protocol_that_passes_its_probe_is_recorded_as_supported).
        camera.AddSupportedProtocol(SupportedProtocol.Onvif);
        var binding = new CameraCapabilityBinding { CameraId = "cam1", Capability = CameraCapability.Ptz, Protocol = SupportedProtocol.Onvif };
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns(binding);
        _ptzProvider.ProbeAsync(camera, binding, Arg.Any<CancellationToken>()).Returns(true);

        await _sut.ExecuteAsync("cam1", CameraCapability.Ptz);

        await _cameras.DidNotReceive().UpdateAsync(Arg.Any<Camera>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_does_not_set_ptz_supported_when_probe_fails()
    {
        var camera = new Camera { Id = "cam1", Slug = "cam1", FrigateCameraName = "cam1", DisplayName = "cam1", Host = "h", PtzSupported = false };
        var binding = new CameraCapabilityBinding { CameraId = "cam1", Capability = CameraCapability.Ptz, Protocol = SupportedProtocol.Onvif };
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns(binding);
        _ptzProvider.ProbeAsync(camera, binding, Arg.Any<CancellationToken>()).Returns(false);

        await _sut.ExecuteAsync("cam1", CameraCapability.Ptz);

        Assert.False(camera.PtzSupported);
        await _cameras.DidNotReceive().UpdateAsync(Arg.Any<Camera>(), Arg.Any<CancellationToken>());
    }
}

public class SeedAndProbePresetsUseCaseTests
{
    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly ICameraCapabilityBindingRepository _bindings = Substitute.For<ICameraCapabilityBindingRepository>();
    private readonly ICapabilityProviderRegistry _registry = Substitute.For<ICapabilityProviderRegistry>();
    private readonly IPtzCapabilityProvider _ptzProvider = Substitute.For<IPtzCapabilityProvider>();
    private readonly IPrivacyCapabilityProvider _privacyProvider = Substitute.For<IPrivacyCapabilityProvider>();
    private readonly IImageSettingsCapabilityProvider _imageSettingsProvider = Substitute.For<IImageSettingsCapabilityProvider>();
    private readonly SeedAndProbePresetsUseCase _sut;

    public SeedAndProbePresetsUseCaseTests()
    {
        _registry.ResolvePtz(Arg.Any<SupportedProtocol>()).Returns(_ptzProvider);
        _registry.ResolvePrivacy(Arg.Any<SupportedProtocol>()).Returns(_privacyProvider);
        _registry.ResolveImageSettings(Arg.Any<SupportedProtocol>()).Returns(_imageSettingsProvider);
        // Blind-probe path (unlisted camera, ADR-28): no candidates by default — tests that
        // exercise it stub the specific capability's candidate list explicitly.
        _registry.GetRegisteredProtocols(Arg.Any<CameraCapability>()).Returns([]);
        var probe = new ProbeCameraCapabilityUseCase(_cameras, _bindings, _registry);
        _sut = new SeedAndProbePresetsUseCase(_cameras, _bindings, probe, _registry);
    }

    [Fact]
    public async Task ExecuteAsync_does_nothing_when_camera_not_found()
    {
        _cameras.GetByIdAsync("x", Arg.Any<CancellationToken>()).Returns((Camera?)null);

        await _sut.ExecuteAsync("x");

        await _bindings.DidNotReceive().SaveAsync(Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_seeds_preset_bindings_and_probes_each_for_known_vendor()
    {
        var camera = new Camera { Id = "cam1", Slug = "cam1", FrigateCameraName = "cam1", DisplayName = "cam1", Host = "h", VendorFamily = VendorFamily.TplinkTapo };
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetAsync("cam1", Arg.Any<CameraCapability>(), Arg.Any<CancellationToken>()).Returns((CameraCapabilityBinding?)null);
        // After SaveAsync, GetAsync returns the saved binding for the probe step
        _bindings.GetAsync("cam1", CameraCapability.HardwarePrivacy, Arg.Any<CancellationToken>())
            .Returns((CameraCapabilityBinding?)null,
                     new CameraCapabilityBinding { CameraId = "cam1", Capability = CameraCapability.HardwarePrivacy, Protocol = SupportedProtocol.TapoKlap });
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>())
            .Returns((CameraCapabilityBinding?)null,
                     new CameraCapabilityBinding { CameraId = "cam1", Capability = CameraCapability.Ptz, Protocol = SupportedProtocol.TapoKlap });
        _privacyProvider.ProbeAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>()).Returns(true);
        _ptzProvider.ProbeAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>()).Returns(true);

        await _sut.ExecuteAsync("cam1");

        // Two preset bindings → two SaveAsync calls to create + two to persist probe result
        await _bindings.Received(4).SaveAsync(Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_blind_probes_ptz_and_removes_binding_when_no_candidate_verifies_for_unlisted_camera()
    {
        var camera = new Camera { Id = "cam1", Slug = "cam1", FrigateCameraName = "cam1", DisplayName = "cam1", Host = "h", VendorFamily = null };
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _registry.GetRegisteredProtocols(CameraCapability.Ptz).Returns([SupportedProtocol.Onvif]);
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>())
            .Returns((CameraCapabilityBinding?)null,
                     new CameraCapabilityBinding { CameraId = "cam1", Capability = CameraCapability.Ptz, Protocol = SupportedProtocol.Onvif });
        _ptzProvider.ProbeAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>()).Returns(false);

        await _sut.ExecuteAsync("cam1");

        // 1 SaveAsync to create tentative binding + 1 from ProbeCameraCapabilityUseCase persisting probe result
        await _bindings.Received(2).SaveAsync(Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>());
        await _bindings.Received(1).DeleteAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_keeps_ptz_binding_when_a_blind_candidate_verifies_for_unlisted_camera()
    {
        var camera = new Camera { Id = "cam1", Slug = "cam1", FrigateCameraName = "cam1", DisplayName = "cam1", Host = "h", VendorFamily = null, PtzSupported = false };
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _registry.GetRegisteredProtocols(CameraCapability.Ptz).Returns([SupportedProtocol.Onvif]);
        var tentativeBinding = new CameraCapabilityBinding { CameraId = "cam1", Capability = CameraCapability.Ptz, Protocol = SupportedProtocol.Onvif };
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>())
            .Returns((CameraCapabilityBinding?)null, tentativeBinding);
        _ptzProvider.ProbeAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>()).Returns(true);

        await _sut.ExecuteAsync("cam1");

        await _bindings.DidNotReceive().DeleteAsync(Arg.Any<string>(), Arg.Any<CameraCapability>(), Arg.Any<CancellationToken>());
        Assert.True(camera.PtzSupported);
    }

    [Fact]
    public async Task ExecuteAsync_tries_every_registered_protocol_in_order_for_unlisted_camera()
    {
        var camera = new Camera { Id = "cam1", Slug = "cam1", FrigateCameraName = "cam1", DisplayName = "cam1", Host = "h", VendorFamily = null };
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _registry.GetRegisteredProtocols(CameraCapability.Ptz).Returns([SupportedProtocol.Onvif, SupportedProtocol.Dvrip, SupportedProtocol.TapoKlap]);

        CameraCapabilityBinding? stored = null;
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns(_ => stored);
        _bindings.When(b => b.SaveAsync(Arg.Is<CameraCapabilityBinding>(x => x.Capability == CameraCapability.Ptz), Arg.Any<CancellationToken>()))
            .Do(call => stored = call.Arg<CameraCapabilityBinding>());

        _ptzProvider.ProbeAsync(Arg.Any<Camera>(), Arg.Is<CameraCapabilityBinding>(b => b.Protocol == SupportedProtocol.Onvif), Arg.Any<CancellationToken>())
            .Returns(false);
        _ptzProvider.ProbeAsync(Arg.Any<Camera>(), Arg.Is<CameraCapabilityBinding>(b => b.Protocol == SupportedProtocol.Dvrip), Arg.Any<CancellationToken>())
            .Returns(false);
        _ptzProvider.ProbeAsync(Arg.Any<Camera>(), Arg.Is<CameraCapabilityBinding>(b => b.Protocol == SupportedProtocol.TapoKlap), Arg.Any<CancellationToken>())
            .Returns(true);

        await _sut.ExecuteAsync("cam1");

        Assert.NotNull(stored);
        Assert.Equal(SupportedProtocol.TapoKlap, stored!.Protocol);
        Assert.True(stored.Verified);
        await _bindings.DidNotReceive().DeleteAsync(Arg.Any<string>(), Arg.Any<CameraCapability>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_blind_probes_image_settings_and_hardware_privacy_too_for_unlisted_camera()
    {
        var camera = new Camera { Id = "cam1", Slug = "cam1", FrigateCameraName = "cam1", DisplayName = "cam1", Host = "h", VendorFamily = null };
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _registry.GetRegisteredProtocols(CameraCapability.ImageSettings).Returns([SupportedProtocol.Onvif]);
        _registry.GetRegisteredProtocols(CameraCapability.HardwarePrivacy).Returns([SupportedProtocol.TapoKlap]);
        // Sequence: first GetAsync call is the cascade loop's own lookup (nothing yet), second
        // is ProbeCameraCapabilityUseCase re-fetching the binding it must probe.
        _bindings.GetAsync("cam1", CameraCapability.ImageSettings, Arg.Any<CancellationToken>())
            .Returns((CameraCapabilityBinding?)null,
                     new CameraCapabilityBinding { CameraId = "cam1", Capability = CameraCapability.ImageSettings, Protocol = SupportedProtocol.Onvif });
        _bindings.GetAsync("cam1", CameraCapability.HardwarePrivacy, Arg.Any<CancellationToken>())
            .Returns((CameraCapabilityBinding?)null,
                     new CameraCapabilityBinding { CameraId = "cam1", Capability = CameraCapability.HardwarePrivacy, Protocol = SupportedProtocol.TapoKlap });
        _imageSettingsProvider.ProbeAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>()).Returns(true);
        _privacyProvider.ProbeAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>()).Returns(true);

        await _sut.ExecuteAsync("cam1");

        await _imageSettingsProvider.Received(1).ProbeAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>());
        await _privacyProvider.Received(1).ProbeAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_skips_capability_with_no_registered_protocol_for_unlisted_camera()
    {
        var camera = new Camera { Id = "cam1", Slug = "cam1", FrigateCameraName = "cam1", DisplayName = "cam1", Host = "h", VendorFamily = null };
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        // Default stub already returns [] for every capability — nothing should be probed at all.

        await _sut.ExecuteAsync("cam1");

        await _bindings.DidNotReceive().SaveAsync(Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>());
    }

    // ADR-28: Icsee declares Ptz candidates [Onvif, Dvrip] in priority order — cascade must
    // try Onvif first and fall back to Dvrip only if Onvif fails to verify.
    [Fact]
    public async Task ExecuteAsync_cascades_to_next_candidate_protocol_when_first_fails_to_verify()
    {
        var camera = new Camera { Id = "cam1", Slug = "cam1", FrigateCameraName = "cam1", DisplayName = "cam1", Host = "h", VendorFamily = VendorFamily.Icsee };
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);

        CameraCapabilityBinding? stored = null;
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns(_ => stored);
        _bindings.When(b => b.SaveAsync(Arg.Is<CameraCapabilityBinding>(x => x.Capability == CameraCapability.Ptz), Arg.Any<CancellationToken>()))
            .Do(call => stored = call.Arg<CameraCapabilityBinding>());

        _ptzProvider.ProbeAsync(Arg.Any<Camera>(), Arg.Is<CameraCapabilityBinding>(b => b.Protocol == SupportedProtocol.Onvif), Arg.Any<CancellationToken>())
            .Returns(false);
        _ptzProvider.ProbeAsync(Arg.Any<Camera>(), Arg.Is<CameraCapabilityBinding>(b => b.Protocol == SupportedProtocol.Dvrip), Arg.Any<CancellationToken>())
            .Returns(true);

        await _sut.ExecuteAsync("cam1");

        Assert.NotNull(stored);
        Assert.Equal(SupportedProtocol.Dvrip, stored!.Protocol);
        Assert.True(stored.Verified);
    }

    [Fact]
    public async Task ExecuteAsync_never_overwrites_a_manually_configured_binding()
    {
        var camera = new Camera { Id = "cam1", Slug = "cam1", FrigateCameraName = "cam1", DisplayName = "cam1", Host = "h", VendorFamily = VendorFamily.Icsee };
        var manual = new CameraCapabilityBinding
        {
            CameraId = "cam1",
            Capability = CameraCapability.Ptz,
            Protocol = SupportedProtocol.Onvif,
            Verified = false,
            ManuallyConfigured = true,
        };
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns(manual);
        _ptzProvider.ProbeAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>()).Returns(false);

        await _sut.ExecuteAsync("cam1");

        // Only the probe's own persistence of the (still-failing) result — the cascade loop
        // must never re-save with a different protocol for a manually configured binding.
        await _bindings.Received(1).SaveAsync(Arg.Is<CameraCapabilityBinding>(b => b.Capability == CameraCapability.Ptz), Arg.Any<CancellationToken>());
        Assert.Equal(SupportedProtocol.Onvif, manual.Protocol);
    }

    [Fact]
    public async Task ExecuteAsync_does_not_reset_already_verified_binding_still_covered_by_preset()
    {
        var camera = new Camera { Id = "cam1", Slug = "cam1", FrigateCameraName = "cam1", DisplayName = "cam1", Host = "h", VendorFamily = VendorFamily.Icsee };
        var verified = new CameraCapabilityBinding
        {
            CameraId = "cam1",
            Capability = CameraCapability.Ptz,
            Protocol = SupportedProtocol.Dvrip,
            Verified = true,
        };
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns(verified);
        _ptzProvider.ProbeAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>()).Returns(true);

        await _sut.ExecuteAsync("cam1");

        Assert.Equal(SupportedProtocol.Dvrip, verified.Protocol);
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

    private static Camera MakeCamera(string id = "cam1", VendorFamily? vendorFamily = null) => new()
    {
        Id = id,
        Slug = id,
        FrigateCameraName = id.Replace('-', '_'),
        DisplayName = id,
        Host = "h",
        VendorFamily = vendorFamily,
    };

    [Fact]
    public async Task ExecuteAsync_returns_null_when_camera_not_found()
    {
        _cameras.GetByIdAsync("x", Arg.Any<CancellationToken>()).Returns((Camera?)null);

        var result = await _sut.ExecuteAsync("x");

        Assert.Null(result);
    }

    [Fact]
    public async Task ExecuteAsync_returns_empty_list_when_no_bindings_and_no_vendor()
    {
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(MakeCamera());
        _bindings.GetByCameraAsync("cam1", Arg.Any<CancellationToken>()).Returns([]);

        var result = await _sut.ExecuteAsync("cam1");

        Assert.NotNull(result);
        Assert.Empty(result!);
    }

    [Fact]
    public async Task ExecuteAsync_maps_non_preset_bindings_with_is_configured_true()
    {
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(MakeCamera());
        _bindings.GetByCameraAsync("cam1", Arg.Any<CancellationToken>()).Returns([
            new CameraCapabilityBinding { CameraId = "cam1", Capability = CameraCapability.Ptz, Protocol = SupportedProtocol.Onvif, Verified = true },
            new CameraCapabilityBinding { CameraId = "cam1", Capability = CameraCapability.HardwarePrivacy, Protocol = SupportedProtocol.TapoKlap, Verified = false },
        ]);

        var result = await _sut.ExecuteAsync("cam1");

        Assert.Equal(2, result!.Count);
        Assert.Contains(result, b => b.Capability == "ptz" && b.Protocol == "onvif" && b.Verified && !b.IsPreset && b.IsConfigured);
        Assert.Contains(result, b => b.Capability == "hardware_privacy" && b.Protocol == "tapo_klap" && !b.Verified && !b.IsPreset && b.IsConfigured);
    }

    [Fact]
    public async Task ExecuteAsync_includes_preset_suggestion_when_no_binding_exists_yet()
    {
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(MakeCamera(vendorFamily: VendorFamily.TplinkTapo));
        _bindings.GetByCameraAsync("cam1", Arg.Any<CancellationToken>()).Returns([]);

        var result = await _sut.ExecuteAsync("cam1");

        // TplinkTapo preset: HardwarePrivacy/TapoKlap + Ptz/TapoKlap
        Assert.Equal(2, result!.Count);
        Assert.Contains(result, b => b.Capability == "hardware_privacy" && b.Protocol == "tapo_klap" && b.IsPreset && !b.IsConfigured && !b.Verified);
        Assert.Contains(result, b => b.Capability == "ptz" && b.Protocol == "tapo_klap" && b.IsPreset && !b.IsConfigured && !b.Verified);
    }

    [Fact]
    public async Task ExecuteAsync_marks_existing_binding_as_preset_when_in_vendor_preset()
    {
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(MakeCamera(vendorFamily: VendorFamily.TplinkTapo));
        _bindings.GetByCameraAsync("cam1", Arg.Any<CancellationToken>()).Returns([
            new CameraCapabilityBinding { CameraId = "cam1", Capability = CameraCapability.HardwarePrivacy, Protocol = SupportedProtocol.TapoKlap, Verified = true },
        ]);

        var result = await _sut.ExecuteAsync("cam1");

        // Ptz not configured yet → synthetic preset entry; HardwarePrivacy configured → isPreset=true, isConfigured=true
        Assert.Equal(2, result!.Count);
        var privacyDto = result.First(b => b.Capability == "hardware_privacy");
        Assert.True(privacyDto.IsPreset);
        Assert.True(privacyDto.IsConfigured);
        Assert.True(privacyDto.Verified);
        var ptzDto = result.First(b => b.Capability == "ptz");
        Assert.True(ptzDto.IsPreset);
        Assert.False(ptzDto.IsConfigured);
    }
}

public class RemoveCameraCapabilityUseCaseTests
{
    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly ICameraCapabilityBindingRepository _bindings = Substitute.For<ICameraCapabilityBindingRepository>();
    private readonly RemoveCameraCapabilityUseCase _sut;

    public RemoveCameraCapabilityUseCaseTests()
    {
        _sut = new RemoveCameraCapabilityUseCase(_cameras, _bindings);
    }

    private static Camera MakeCamera(string id = "cam1") => new()
    {
        Id = id,
        Slug = id,
        FrigateCameraName = id.Replace('-', '_'),
        DisplayName = id,
        Host = "192.168.1.10",
    };

    [Fact]
    public async Task ExecuteAsync_returns_false_when_camera_not_found()
    {
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns((Camera?)null);

        var result = await _sut.ExecuteAsync("cam1", CameraCapability.ImageSettings);

        Assert.False(result);
        await _bindings.DidNotReceive().DeleteAsync(Arg.Any<string>(), Arg.Any<CameraCapability>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_returns_false_when_binding_not_found()
    {
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(MakeCamera());
        _bindings.GetAsync("cam1", CameraCapability.ImageSettings, Arg.Any<CancellationToken>()).Returns((CameraCapabilityBinding?)null);

        var result = await _sut.ExecuteAsync("cam1", CameraCapability.ImageSettings);

        Assert.False(result);
        await _bindings.DidNotReceive().DeleteAsync(Arg.Any<string>(), Arg.Any<CameraCapability>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_deletes_binding_and_returns_true_when_found()
    {
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(MakeCamera());
        _bindings.GetAsync("cam1", CameraCapability.ImageSettings, Arg.Any<CancellationToken>())
            .Returns(new CameraCapabilityBinding { CameraId = "cam1", Capability = CameraCapability.ImageSettings, Protocol = SupportedProtocol.Onvif });

        var result = await _sut.ExecuteAsync("cam1", CameraCapability.ImageSettings);

        Assert.True(result);
        await _bindings.Received(1).DeleteAsync("cam1", CameraCapability.ImageSettings, Arg.Any<CancellationToken>());
    }
}
