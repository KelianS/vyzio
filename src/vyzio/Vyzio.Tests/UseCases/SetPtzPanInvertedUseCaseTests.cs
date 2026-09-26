using NSubstitute;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Core.Common;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Tests.UseCases;

public class SetPtzPanInvertedUseCaseTests
{
    private readonly ICameraCapabilityBindingRepository _bindings = Substitute.For<ICameraCapabilityBindingRepository>();

    [Fact]
    public async Task ExecuteAsync_ShouldSaveTheSettingAndKeepTheRestOfTheConfig_WhenInverted()
    {
        var binding = PtzBinding.With("""{"supports_native_presets":true}""");
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns(binding);

        var dto = await new SetPtzPanInvertedUseCase(_bindings).ExecuteAsync("cam1", inverted: true);

        Assert.True(dto!.PanInverted);
        Assert.True(BindingConfig.ReadBool(binding.ConfigJson, BindingConfig.SupportsNativePresets));
        await _bindings.Received(1).SaveAsync(binding, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldReturnNothing_WhenTheCameraHasNoPtz()
    {
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns((CameraCapabilityBinding?)null);

        Assert.Null(await new SetPtzPanInvertedUseCase(_bindings).ExecuteAsync("cam1", inverted: true));
    }
}

public class CameraCapabilityBindingDtoTests
{
    [Fact]
    public void From_ShouldCarryNoSwap_WhenTheBindingIsNotPtz()
    {
        var binding = PtzBinding.With("""{"pan_inverted":true}""");
        binding.Capability = CameraCapability.ImageSettings;

        Assert.Null(CameraCapabilityBindingDto.From(binding).PanInverted);
    }
}
