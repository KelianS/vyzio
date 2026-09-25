using System.Text.Json;
using NSubstitute;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Core.Common;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Tests.UseCases;

internal static class PtzBinding
{
    public static CameraCapabilityBinding With(string? configJson) => new()
    {
        CameraId = "cam1",
        Capability = CameraCapability.Ptz,
        Protocol = SupportedProtocol.Onvif,
        Verified = true,
        ConfigJson = configJson,
    };
}

public class PtzStepUseCaseTests
{
    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly ICameraCapabilityBindingRepository _bindings = Substitute.For<ICameraCapabilityBindingRepository>();
    private readonly ICapabilityProviderRegistry _registry = Substitute.For<ICapabilityProviderRegistry>();
    private readonly IPtzCapabilityProvider _provider = Substitute.For<IPtzCapabilityProvider>();
    private readonly Camera _camera = new() { Id = "cam1", Slug = "cam1", FrigateCameraName = "cam1", DisplayName = "cam1", Host = "192.168.1.10" };

    public PtzStepUseCaseTests()
    {
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(_camera);
        _registry.ResolvePtz(SupportedProtocol.Onvif).Returns(_provider);
    }

    [Theory]
    [InlineData("Left", PtzDirection.Right)]
    [InlineData("Right", PtzDirection.Left)]
    [InlineData("UpLeft", PtzDirection.UpRight)]
    [InlineData("UpRight", PtzDirection.UpLeft)]
    [InlineData("DownLeft", PtzDirection.DownRight)]
    [InlineData("DownRight", PtzDirection.DownLeft)]
    [InlineData("Up", PtzDirection.Up)]
    [InlineData("Down", PtzDirection.Down)]
    public async Task ExecuteAsync_ShouldSwapLeftAndRight_WhenTheCameraIsSetToTurnTheOtherWay(string pressed, PtzDirection sent)
    {
        var binding = PtzBinding.With("""{"supports_native_presets":true,"pan_inverted":true}""");
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
        var binding = PtzBinding.With(configJson);
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns(binding);

        await new PtzStepUseCase(_cameras, _bindings, _registry).ExecuteAsync("cam1", new PtzMoveRequest("Left"));

        await _provider.Received(1).PtzStepAsync(_camera, binding, PtzDirection.Left, Arg.Any<int>(), Arg.Any<CancellationToken>());
    }
}

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
        Assert.True(BindingConfig.ReadBool(binding.ConfigJson, "supports_native_presets"));
        await _bindings.Received(1).SaveAsync(binding, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldReturnNothing_WhenTheCameraHasNoPtz()
    {
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns((CameraCapabilityBinding?)null);

        Assert.Null(await new SetPtzPanInvertedUseCase(_bindings).ExecuteAsync("cam1", inverted: true));
    }
}

public class BindingConfigTests
{
    [Fact]
    public void Carry_ShouldKeepTheSwap_WhenANewConfigDoesNotNameIt()
    {
        var carried = BindingConfig.Carry("""{"pan_inverted":true}""", """{"device_id":42}""", BindingConfig.PanInverted);

        Assert.True(BindingConfig.ReadBool(carried, BindingConfig.PanInverted));
        Assert.Contains("\"device_id\":42", carried, StringComparison.Ordinal);
    }

    [Fact]
    public void Carry_ShouldLeaveTheNewConfig_WhenTheOldOneHadNoSwap()
    {
        Assert.Null(BindingConfig.Carry("""{"supports_native_presets":true}""", null, BindingConfig.PanInverted));
    }

    [Fact]
    public void With_ShouldRaise_WhenTheConfigCannotBeRead()
    {
        Assert.ThrowsAny<JsonException>(() => BindingConfig.With("not json", BindingConfig.PanInverted, true));
    }

    [Fact]
    public void From_ShouldCarryNoSwap_WhenTheBindingIsNotPtz()
    {
        var binding = PtzBinding.With("""{"pan_inverted":true}""");
        binding.Capability = CameraCapability.ImageSettings;

        Assert.Null(CameraCapabilityBindingDto.From(binding).PanInverted);
    }
}
