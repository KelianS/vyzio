using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Tests.UseCases;

// On the native tier the camera alone holds the slot: Vyzio orders it stored and keeps no row (ADR-69).
public class PtzSavePresetUseCaseTests
{
    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly ICameraCapabilityBindingRepository _bindings = Substitute.For<ICameraCapabilityBindingRepository>();
    private readonly ICapabilityProviderRegistry _registry = Substitute.For<ICapabilityProviderRegistry>();
    private readonly IPtzCapabilityProvider _provider = Substitute.For<IPtzCapabilityProvider>();
    private readonly IPtzPresetRepository _presets = Substitute.For<IPtzPresetRepository>();
    private readonly IPtzThumbnailStore _thumbnails = Substitute.For<IPtzThumbnailStore>();
    private readonly Camera _camera = new() { Id = "cam1", Slug = "cam1", FrigateCameraName = "cam1", DisplayName = "cam1", Host = "192.168.1.10" };
    private readonly CameraCapabilityBinding _binding = new()
    {
        CameraId = "cam1",
        Capability = CameraCapability.Ptz,
        Protocol = SupportedProtocol.Onvif,
        Status = CapabilityStatus.Verified,
        ConfigJson = """{"supports_native_presets":true}""",
    };

    public PtzSavePresetUseCaseTests()
    {
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(_camera);
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns(_binding);
        _registry.ResolvePtz(SupportedProtocol.Onvif).Returns(_provider);
    }

    private Task<bool> Save(int presetId) => new PtzSavePresetUseCase(
        _cameras, _bindings, _registry, _presets, _thumbnails, new PtzManagedPositions(TimeProvider.System, NullLogger<PtzManagedPositions>.Instance))
        .ExecuteAsync("cam1", presetId);

    [Fact]
    public async Task ExecuteAsync_ShouldStoreTheSlotAsTheCamerasPresetOfThatNumberAndKeepNoRow_WhenTheCameraKeepsItsOwnPresets()
    {
        // Arrange & Act
        var saved = await Save(PtzPreset.ParkingSlot);

        // Assert
        Assert.True(saved);
        await _provider.Received(1).PtzSavePresetAsync(_camera, _binding, PtzPreset.ParkingSlot, Arg.Any<CancellationToken>());
        await _presets.DidNotReceive().UpsertAsync(Arg.Any<PtzPreset>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldDropTheSlotsOldThumbnail_WhenANewViewIsSavedThere()
    {
        // Arrange & Act
        await Save(PtzPreset.SurveillanceSlot);

        // Assert
        await _thumbnails.Received(1).DeleteAsync("cam1", PtzPreset.SurveillanceSlot, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldRaiseTheCamerasReasonAndKeepTheThumbnail_WhenTheCameraRefusesTheSlotsNumber()
    {
        // Arrange
        _provider.PtzSavePresetAsync(_camera, _binding, PtzPreset.ParkingSlot, Arg.Any<CancellationToken>())
            .Returns(Task.FromException(new CameraCommandRefusedException("ONVIF SetPreset: asked for preset token 2, the camera stored it under 7.")));

        // Act
        var error = await Record.ExceptionAsync(() => Save(PtzPreset.ParkingSlot));

        // Assert
        Assert.IsType<CameraCommandRefusedException>(error);
        await _thumbnails.DidNotReceive().DeleteAsync(Arg.Any<string>(), Arg.Any<int>(), Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData(0)]
    [InlineData(PtzPreset.LastSlot + 1)]
    public async Task ExecuteAsync_ShouldStoreNothing_WhenTheNumberIsNoSlot(int presetId)
    {
        // Arrange & Act
        var saved = await Save(presetId);

        // Assert
        Assert.False(saved);
        await _provider.DidNotReceive().PtzSavePresetAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<int>(), Arg.Any<CancellationToken>());
    }
}
