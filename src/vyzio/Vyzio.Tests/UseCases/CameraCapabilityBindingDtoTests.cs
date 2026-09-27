using Vyzio.Application.UseCases.Cameras;
using Vyzio.Core.Entities;

namespace Vyzio.Tests.UseCases;

public class CameraCapabilityBindingDtoTests
{
    [Fact]
    public void From_ShouldCarryNoSwap_WhenTheBindingIsNotPtz()
    {
        var binding = PtzBinding.With("""{"pan_inverted":true}""");
        binding.Capability = CameraCapability.ImageSettings;

        Assert.Null(CameraCapabilityBindingDto.From(binding).PanInverted);
    }

    [Fact]
    public void From_ShouldSayTheCameraKeepsItsPositions_WhenThePtzProbeFoundNativePresets()
    {
        // Arrange
        var binding = PtzBinding.With("""{"supports_native_presets":true}""");

        // Act
        var dto = CameraCapabilityBindingDto.From(binding);

        // Assert
        Assert.True(dto.NativePositions);
    }

    [Fact]
    public void From_ShouldSayVyzioKeepsThePositions_WhenThePtzProbeFoundNoNativePresets()
    {
        // Arrange
        var binding = PtzBinding.With("""{"supports_native_presets":false}""");

        // Act
        var dto = CameraCapabilityBindingDto.From(binding);

        // Assert
        Assert.False(dto.NativePositions);
    }

    [Fact]
    public void From_ShouldCarryNoPositionKeeper_WhenTheBindingIsNotPtz()
    {
        // Arrange
        var binding = PtzBinding.With("""{"supports_native_presets":true}""");
        binding.Capability = CameraCapability.ImageSettings;

        // Act
        var dto = CameraCapabilityBindingDto.From(binding);

        // Assert
        Assert.Null(dto.NativePositions);
    }
}
