using NSubstitute;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Tests.UseCases;

public class PtzSavePresetUseCaseTests
{
    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly ICameraCapabilityBindingRepository _bindings = Substitute.For<ICameraCapabilityBindingRepository>();
    private readonly ICapabilityProviderRegistry _registry = Substitute.For<ICapabilityProviderRegistry>();
    private readonly IPtzCapabilityProvider _provider = Substitute.For<IPtzCapabilityProvider>();
    private readonly IPtzPresetRepository _presets = Substitute.For<IPtzPresetRepository>();

    [Fact]
    public async Task ExecuteAsync_ShouldRecordTheSlotAsSaved_WhenTheCameraKeepsItsOwnPresets()
    {
        var camera = new Camera { Id = "cam1", Slug = "cam1", FrigateCameraName = "cam1", DisplayName = "cam1", Host = "192.168.1.10" };
        var binding = new CameraCapabilityBinding
        {
            CameraId = "cam1",
            Capability = CameraCapability.Ptz,
            Protocol = SupportedProtocol.Onvif,
            Verified = true,
            ConfigJson = """{"supports_native_presets":true}""",
        };
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns(binding);
        _registry.ResolvePtz(SupportedProtocol.Onvif).Returns(_provider);

        await new PtzSavePresetUseCase(_cameras, _bindings, _registry, _presets).ExecuteAsync("cam1", PtzPreset.ParkingSlot);

        await _provider.Received(1).PtzSavePresetAsync(camera, binding, PtzPreset.ParkingSlot, Arg.Any<CancellationToken>());
        await _presets.Received(1).UpsertAsync(
            Arg.Is<PtzPreset>(p => p.PresetId == PtzPreset.ParkingSlot && p.Native && p.NativeToken == "2"),
            Arg.Any<CancellationToken>());
    }
}
