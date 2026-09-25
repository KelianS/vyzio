using NSubstitute;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Tests.UseCases;

public class PtzPanDirectionTests
{
    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly ICameraCapabilityBindingRepository _bindings = Substitute.For<ICameraCapabilityBindingRepository>();
    private readonly ICapabilityProviderRegistry _registry = Substitute.For<ICapabilityProviderRegistry>();
    private readonly IPtzCapabilityProvider _provider = Substitute.For<IPtzCapabilityProvider>();
    private readonly Camera _camera = new() { Id = "cam1", Slug = "cam1", FrigateCameraName = "cam1", DisplayName = "cam1", Host = "192.168.1.10" };

    public PtzPanDirectionTests()
    {
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(_camera);
        _registry.ResolvePtz(SupportedProtocol.Onvif).Returns(_provider);
    }

    private static CameraCapabilityBinding Binding(string? configJson) => new()
    {
        CameraId = "cam1",
        Capability = CameraCapability.Ptz,
        Protocol = SupportedProtocol.Onvif,
        Verified = true,
        ConfigJson = configJson,
    };

    [Theory]
    [InlineData("Left", PtzDirection.Right)]
    [InlineData("Right", PtzDirection.Left)]
    [InlineData("UpLeft", PtzDirection.UpRight)]
    [InlineData("DownRight", PtzDirection.DownLeft)]
    [InlineData("Up", PtzDirection.Up)]
    [InlineData("Down", PtzDirection.Down)]
    public async Task ExecuteAsync_ShouldSwapLeftAndRight_WhenTheCameraIsSetToTurnTheOtherWay(string pressed, PtzDirection sent)
    {
        var binding = Binding("""{"supports_native_presets":true,"pan_inverted":true}""");
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns(binding);

        await new PtzStepUseCase(_cameras, _bindings, _registry).ExecuteAsync("cam1", new PtzMoveRequest(pressed));

        await _provider.Received(1).PtzStepAsync(_camera, binding, sent, Arg.Any<int>(), Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData(null)]
    [InlineData("""{"pan_inverted":false}""")]
    [InlineData("not json")]
    public async Task ExecuteAsync_ShouldSendTheDirectionPressed_WhenTheCameraIsNotSetToTurnTheOtherWay(string? configJson)
    {
        var binding = Binding(configJson);
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns(binding);

        await new PtzStepUseCase(_cameras, _bindings, _registry).ExecuteAsync("cam1", new PtzMoveRequest("Left"));

        await _provider.Received(1).PtzStepAsync(_camera, binding, PtzDirection.Left, Arg.Any<int>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldSaveTheSettingAndKeepTheRestOfTheConfig_WhenInverted()
    {
        var binding = Binding("""{"supports_native_presets":true}""");
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns(binding);

        var dto = await new SetPtzPanInvertedUseCase(_bindings).ExecuteAsync("cam1", inverted: true);

        Assert.NotNull(dto);
        Assert.Contains("\"supports_native_presets\":true", binding.ConfigJson, StringComparison.Ordinal);
        Assert.Contains("\"pan_inverted\":true", binding.ConfigJson, StringComparison.Ordinal);
        await _bindings.Received(1).SaveAsync(binding, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldReturnNothing_WhenTheCameraHasNoPtz()
    {
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns((CameraCapabilityBinding?)null);

        Assert.Null(await new SetPtzPanInvertedUseCase(_bindings).ExecuteAsync("cam1", inverted: true));
    }
}
