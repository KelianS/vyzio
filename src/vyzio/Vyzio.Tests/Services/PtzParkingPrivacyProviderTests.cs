using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.CapabilityProviders;

namespace Vyzio.Tests.Services;

public class PtzParkingPrivacyProviderTests
{
    private readonly ICameraCapabilityBindingRepository _bindings = Substitute.For<ICameraCapabilityBindingRepository>();
    private readonly IPtzCapabilityProvider _ptzProvider = Substitute.For<IPtzCapabilityProvider>();

    private PtzParkingPrivacyProvider MakeProvider(CapabilityProtocol protocol = CapabilityProtocol.Onvif)
    {
        _ptzProvider.Protocol.Returns(protocol);
        return new PtzParkingPrivacyProvider(
            [_ptzProvider],
            _bindings,
            NullLogger<PtzParkingPrivacyProvider>.Instance);
    }

    private static Camera MakeCamera(string id = "cam1") => new()
    {
        Id = id,
        Slug = id,
        DisplayName = id,
        Host = "192.168.1.10",
    };

    private static CameraCapabilityBinding MakePtzBinding(string cameraId, CapabilityProtocol protocol) => new()
    {
        CameraId = cameraId,
        Capability = CameraCapability.Ptz,
        Protocol = protocol,
        Verified = true,
    };

    private static CameraCapabilityBinding MakeParkingBinding(string cameraId) => new()
    {
        CameraId = cameraId,
        Capability = CameraCapability.PrivacyMode,
        Protocol = CapabilityProtocol.PtzParking,
        Verified = true,
    };

    [Fact]
    public void Protocol_is_PtzParking()
    {
        Assert.Equal(CapabilityProtocol.PtzParking, MakeProvider().Protocol);
    }

    [Fact]
    public async Task SetPrivacyModeAsync_active_calls_PtzMove_DownLeft_speed80()
    {
        var camera = MakeCamera();
        var ptzBinding = MakePtzBinding("cam1", CapabilityProtocol.Onvif);
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns(ptzBinding);

        await MakeProvider().SetPrivacyModeAsync(camera, MakeParkingBinding("cam1"), active: true);

        await _ptzProvider.Received(1).PtzMoveAsync(camera, ptzBinding, PtzDirection.DownLeft, 80, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task SetPrivacyModeAsync_deactivate_calls_GotoPreset_1()
    {
        var camera = MakeCamera();
        var ptzBinding = MakePtzBinding("cam1", CapabilityProtocol.Onvif);
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns(ptzBinding);

        await MakeProvider().SetPrivacyModeAsync(camera, MakeParkingBinding("cam1"), active: false);

        await _ptzProvider.Received(1).PtzGoToPresetAsync(camera, ptzBinding, 1, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task SetPrivacyModeAsync_skips_when_no_ptz_binding()
    {
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>())
            .Returns((CameraCapabilityBinding?)null);

        // Must not throw; provider silently skips when no PTZ binding available.
        await MakeProvider().SetPrivacyModeAsync(MakeCamera(), MakeParkingBinding("cam1"), active: true);

        await _ptzProvider.DidNotReceive().PtzMoveAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<PtzDirection>(), Arg.Any<int>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task SetPrivacyModeAsync_skips_when_ptz_binding_not_verified()
    {
        var unverifiedPtz = new CameraCapabilityBinding
        {
            CameraId = "cam1",
            Capability = CameraCapability.Ptz,
            Protocol = CapabilityProtocol.Onvif,
            Verified = false,
        };
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns(unverifiedPtz);

        await MakeProvider().SetPrivacyModeAsync(MakeCamera(), MakeParkingBinding("cam1"), active: true);

        await _ptzProvider.DidNotReceive().PtzMoveAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<PtzDirection>(), Arg.Any<int>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ProbeAsync_delegates_to_correct_ptz_provider_via_binding_protocol()
    {
        var camera = MakeCamera();
        var ptzBinding = MakePtzBinding("cam1", CapabilityProtocol.Onvif);
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns(ptzBinding);
        _ptzProvider.ProbeAsync(camera, ptzBinding, Arg.Any<CancellationToken>()).Returns(true);

        var result = await MakeProvider().ProbeAsync(camera, MakeParkingBinding("cam1"));

        Assert.True(result);
        await _ptzProvider.Received(1).ProbeAsync(camera, ptzBinding, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ProbeAsync_returns_false_when_no_ptz_binding()
    {
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>())
            .Returns((CameraCapabilityBinding?)null);

        var result = await MakeProvider().ProbeAsync(MakeCamera(), MakeParkingBinding("cam1"));

        Assert.False(result);
    }

    [Fact]
    public async Task SetPrivacyModeAsync_selects_provider_matching_binding_protocol()
    {
        var dvripPtz = Substitute.For<IPtzCapabilityProvider>();
        dvripPtz.Protocol.Returns(CapabilityProtocol.Dvrip);

        _ptzProvider.Protocol.Returns(CapabilityProtocol.Onvif);

        var sut = new PtzParkingPrivacyProvider(
            [_ptzProvider, dvripPtz],
            _bindings,
            NullLogger<PtzParkingPrivacyProvider>.Instance);

        var camera = MakeCamera();
        var dvripBinding = MakePtzBinding("cam1", CapabilityProtocol.Dvrip);
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns(dvripBinding);

        await sut.SetPrivacyModeAsync(camera, MakeParkingBinding("cam1"), active: true);

        await dvripPtz.Received(1).PtzMoveAsync(camera, dvripBinding, PtzDirection.DownLeft, 80, Arg.Any<CancellationToken>());
        await _ptzProvider.DidNotReceive().PtzMoveAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<PtzDirection>(), Arg.Any<int>(), Arg.Any<CancellationToken>());
    }
}
