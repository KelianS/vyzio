using NSubstitute;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Tests.UseCases;

public class BackfillCameraCapabilityBindingsUseCaseTests
{
    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly ICameraCapabilityBindingRepository _bindings = Substitute.For<ICameraCapabilityBindingRepository>();
    private readonly BackfillCameraCapabilityBindingsUseCase _sut;

    public BackfillCameraCapabilityBindingsUseCaseTests()
    {
        // Default: no existing bindings
        _bindings.GetAsync(Arg.Any<string>(), Arg.Any<CameraCapability>(), Arg.Any<CancellationToken>())
            .Returns((CameraCapabilityBinding?)null);
        _sut = new BackfillCameraCapabilityBindingsUseCase(_cameras, _bindings);
    }

    private static Camera MakeTapoCamera(bool vendorCut = false, PrivacyModeStrategy strategy = PrivacyModeStrategy.Hardware, bool ptzSupported = false) => new()
    {
        Id = "cam1",
        Slug = "cam1",
        DisplayName = "Tapo C200",
        Host = "192.168.1.50",
        VendorFamily = VendorFamily.TplinkTapo,
        PrivacyModeStrategy = strategy,
        PrivacyVendorCut = vendorCut,
        PtzSupported = ptzSupported,
    };

    private static Camera MakeIcseeCamera(bool ptzSupported = true) => new()
    {
        Id = "cam2",
        Slug = "cam2",
        DisplayName = "ICSee",
        Host = "192.168.1.193",
        VendorFamily = VendorFamily.Icsee,
        PrivacyModeStrategy = PrivacyModeStrategy.PtzParking,
        PtzSupported = ptzSupported,
    };

    private static Camera MakeV380Camera(bool ptzSupported = true) => new()
    {
        Id = "cam3",
        Slug = "cam3",
        DisplayName = "V380",
        Host = "192.168.1.135",
        VendorFamily = VendorFamily.V380Pro,
        PrivacyModeStrategy = PrivacyModeStrategy.PtzParking,
        PtzSupported = ptzSupported,
    };

    [Fact]
    public async Task Tapo_Hardware_strategy_creates_PrivacyMode_TapoKlap_binding()
    {
        _cameras.GetAllAsync(Arg.Any<CancellationToken>()).Returns([MakeTapoCamera()]);

        await _sut.ExecuteAsync();

        await _bindings.Received(1).SaveAsync(
            Arg.Is<CameraCapabilityBinding>(b =>
                b.Capability == CameraCapability.PrivacyMode &&
                b.Protocol == CapabilityProtocol.TapoKlap),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Tapo_Hardware_strategy_with_vendorCut_true_sets_verified_true()
    {
        _cameras.GetAllAsync(Arg.Any<CancellationToken>()).Returns([MakeTapoCamera(vendorCut: true)]);

        await _sut.ExecuteAsync();

        await _bindings.Received(1).SaveAsync(
            Arg.Is<CameraCapabilityBinding>(b =>
                b.Capability == CameraCapability.PrivacyMode &&
                b.Protocol == CapabilityProtocol.TapoKlap &&
                b.Verified == true),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Tapo_Hardware_strategy_with_vendorCut_false_sets_verified_false()
    {
        _cameras.GetAllAsync(Arg.Any<CancellationToken>()).Returns([MakeTapoCamera(vendorCut: false)]);

        await _sut.ExecuteAsync();

        await _bindings.Received(1).SaveAsync(
            Arg.Is<CameraCapabilityBinding>(b =>
                b.Capability == CameraCapability.PrivacyMode &&
                b.Verified == false),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task PtzParking_strategy_creates_PrivacyMode_PtzParking_binding()
    {
        _cameras.GetAllAsync(Arg.Any<CancellationToken>()).Returns([MakeIcseeCamera()]);

        await _sut.ExecuteAsync();

        await _bindings.Received(1).SaveAsync(
            Arg.Is<CameraCapabilityBinding>(b =>
                b.Capability == CameraCapability.PrivacyMode &&
                b.Protocol == CapabilityProtocol.PtzParking),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Software_strategy_creates_no_privacy_binding()
    {
        var camera = MakeTapoCamera(strategy: PrivacyModeStrategy.Software);
        _cameras.GetAllAsync(Arg.Any<CancellationToken>()).Returns([camera]);

        await _sut.ExecuteAsync();

        await _bindings.DidNotReceive().SaveAsync(
            Arg.Is<CameraCapabilityBinding>(b => b.Capability == CameraCapability.PrivacyMode),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ICSee_PtzSupported_creates_Ptz_Dvrip_binding()
    {
        _cameras.GetAllAsync(Arg.Any<CancellationToken>()).Returns([MakeIcseeCamera(ptzSupported: true)]);

        await _sut.ExecuteAsync();

        await _bindings.Received(1).SaveAsync(
            Arg.Is<CameraCapabilityBinding>(b =>
                b.Capability == CameraCapability.Ptz &&
                b.Protocol == CapabilityProtocol.Dvrip &&
                b.Verified == true),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task V380Pro_PtzSupported_creates_Ptz_Onvif_binding()
    {
        _cameras.GetAllAsync(Arg.Any<CancellationToken>()).Returns([MakeV380Camera(ptzSupported: true)]);

        await _sut.ExecuteAsync();

        await _bindings.Received(1).SaveAsync(
            Arg.Is<CameraCapabilityBinding>(b =>
                b.Capability == CameraCapability.Ptz &&
                b.Protocol == CapabilityProtocol.Onvif &&
                b.Verified == true),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task TaplinkTapo_PtzSupported_does_not_create_Ptz_binding()
    {
        // Tapo PTZ is a new capability — never auto-backfilled, must go through probe (ADR-22).
        _cameras.GetAllAsync(Arg.Any<CancellationToken>()).Returns([MakeTapoCamera(ptzSupported: true)]);

        await _sut.ExecuteAsync();

        await _bindings.DidNotReceive().SaveAsync(
            Arg.Is<CameraCapabilityBinding>(b => b.Capability == CameraCapability.Ptz),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Camera_without_PtzSupported_creates_no_Ptz_binding()
    {
        _cameras.GetAllAsync(Arg.Any<CancellationToken>()).Returns([MakeIcseeCamera(ptzSupported: false)]);

        await _sut.ExecuteAsync();

        await _bindings.DidNotReceive().SaveAsync(
            Arg.Is<CameraCapabilityBinding>(b => b.Capability == CameraCapability.Ptz),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Existing_binding_is_not_overwritten()
    {
        var existing = new CameraCapabilityBinding
        {
            CameraId = "cam1",
            Capability = CameraCapability.PrivacyMode,
            Protocol = CapabilityProtocol.TapoKlap,
            Verified = true,
        };
        _bindings.GetAsync("cam1", CameraCapability.PrivacyMode, Arg.Any<CancellationToken>()).Returns(existing);
        _cameras.GetAllAsync(Arg.Any<CancellationToken>()).Returns([MakeTapoCamera()]);

        await _sut.ExecuteAsync();

        // SaveAsync should not be called for the already-existing PrivacyMode binding
        await _bindings.DidNotReceive().SaveAsync(
            Arg.Is<CameraCapabilityBinding>(b => b.Capability == CameraCapability.PrivacyMode),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Multiple_cameras_each_get_their_own_bindings()
    {
        _cameras.GetAllAsync(Arg.Any<CancellationToken>()).Returns([
            MakeIcseeCamera(),
            MakeV380Camera(),
        ]);

        await _sut.ExecuteAsync();

        await _bindings.Received(1).SaveAsync(
            Arg.Is<CameraCapabilityBinding>(b => b.CameraId == "cam2" && b.Protocol == CapabilityProtocol.Dvrip),
            Arg.Any<CancellationToken>());
        await _bindings.Received(1).SaveAsync(
            Arg.Is<CameraCapabilityBinding>(b => b.CameraId == "cam3" && b.Protocol == CapabilityProtocol.Onvif),
            Arg.Any<CancellationToken>());
    }
}
