using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Tests.UseCases;

public class GetCameraImageSettingsUseCaseTests
{
    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly ICameraCapabilityBindingRepository _bindings = Substitute.For<ICameraCapabilityBindingRepository>();
    private readonly ICapabilityProviderRegistry _registry = Substitute.For<ICapabilityProviderRegistry>();
    private readonly IImageSettingsCapabilityProvider _provider = Substitute.For<IImageSettingsCapabilityProvider>();
    private readonly GetCameraImageSettingsUseCase _sut;

    public GetCameraImageSettingsUseCaseTests()
    {
        _registry.ResolveImageSettings(Arg.Any<SupportedProtocol>()).Returns(_provider);
        _sut = new GetCameraImageSettingsUseCase(_cameras, _bindings, _registry, NullLogger<GetCameraImageSettingsUseCase>.Instance);
    }

    private static Camera MakeCamera(string id = "cam1") => new()
    {
        Id = id,
        Slug = id,
        FrigateCameraName = id.Replace('-', '_'),
        DisplayName = id,
        Host = "192.168.1.10",
    };

    private static CameraCapabilityBinding MakeBinding(bool verified) => new()
    {
        CameraId = "cam1",
        Capability = CameraCapability.ImageSettings,
        Protocol = SupportedProtocol.Onvif,
        Verified = verified,
    };

    [Fact]
    public async Task ExecuteAsync_returns_null_when_camera_not_found()
    {
        _cameras.GetByIdAsync("x", Arg.Any<CancellationToken>()).Returns((Camera?)null);

        var result = await _sut.ExecuteAsync("x");

        Assert.Null(result);
    }

    [Fact]
    public async Task ExecuteAsync_returns_null_when_binding_not_verified()
    {
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(MakeCamera());
        _bindings.GetAsync("cam1", CameraCapability.ImageSettings, Arg.Any<CancellationToken>()).Returns(MakeBinding(verified: false));

        var result = await _sut.ExecuteAsync("cam1");

        Assert.Null(result);
        await _provider.DidNotReceive().GetImageSettingsAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_returns_dto_from_provider_when_verified()
    {
        var camera = MakeCamera();
        var binding = MakeBinding(verified: true);
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetAsync("cam1", CameraCapability.ImageSettings, Arg.Any<CancellationToken>()).Returns(binding);
        _provider.GetImageSettingsAsync(camera, binding, Arg.Any<CancellationToken>())
            .Returns(new CameraImageSettings(50, 60, 70, 80, IrCutMode.Auto));

        var result = await _sut.ExecuteAsync("cam1");

        Assert.NotNull(result);
        Assert.Equal(50, result!.Brightness);
        Assert.Equal(60, result.Contrast);
        Assert.Equal(70, result.Saturation);
        Assert.Equal(80, result.Sharpness);
        Assert.Equal("auto", result.IrCutMode);
    }
}

public class SetCameraImageSettingsUseCaseTests
{
    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly ICameraCapabilityBindingRepository _bindings = Substitute.For<ICameraCapabilityBindingRepository>();
    private readonly ICapabilityProviderRegistry _registry = Substitute.For<ICapabilityProviderRegistry>();
    private readonly IImageSettingsCapabilityProvider _provider = Substitute.For<IImageSettingsCapabilityProvider>();
    private readonly SetCameraImageSettingsUseCase _sut;

    public SetCameraImageSettingsUseCaseTests()
    {
        _registry.ResolveImageSettings(Arg.Any<SupportedProtocol>()).Returns(_provider);
        _sut = new SetCameraImageSettingsUseCase(_cameras, _bindings, _registry, NullLogger<SetCameraImageSettingsUseCase>.Instance);
    }

    private static Camera MakeCamera(string id = "cam1") => new()
    {
        Id = id,
        Slug = id,
        FrigateCameraName = id.Replace('-', '_'),
        DisplayName = id,
        Host = "192.168.1.10",
    };

    private static CameraCapabilityBinding MakeBinding(bool verified) => new()
    {
        CameraId = "cam1",
        Capability = CameraCapability.ImageSettings,
        Protocol = SupportedProtocol.Onvif,
        Verified = verified,
    };

    [Fact]
    public async Task ExecuteAsync_returns_null_when_binding_not_verified()
    {
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(MakeCamera());
        _bindings.GetAsync("cam1", CameraCapability.ImageSettings, Arg.Any<CancellationToken>()).Returns(MakeBinding(verified: false));
        var request = new CameraImageSettingsDto(10, 20, 30, 40, "on");

        var result = await _sut.ExecuteAsync("cam1", request);

        Assert.Null(result);
        await _provider.DidNotReceive().SetImageSettingsAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CameraImageSettings>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_writes_then_returns_settings_read_back_from_camera()
    {
        var camera = MakeCamera();
        var binding = MakeBinding(verified: true);
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetAsync("cam1", CameraCapability.ImageSettings, Arg.Any<CancellationToken>()).Returns(binding);
        var request = new CameraImageSettingsDto(10, 20, 30, 40, "on");
        // Firmware clamps sharpness differently than requested — the use case must return what was actually read back.
        _provider.GetImageSettingsAsync(camera, binding, Arg.Any<CancellationToken>())
            .Returns(new CameraImageSettings(10, 20, 30, 35, IrCutMode.On));

        var result = await _sut.ExecuteAsync("cam1", request);

        await _provider.Received(1).SetImageSettingsAsync(
            camera, binding,
            Arg.Is<CameraImageSettings>(s => s.Brightness == 10 && s.Contrast == 20 && s.Saturation == 30 && s.Sharpness == 40 && s.IrCutMode == IrCutMode.On),
            Arg.Any<CancellationToken>());
        Assert.NotNull(result);
        Assert.Equal(35, result!.Sharpness);
        Assert.Equal("on", result.IrCutMode);
    }
}
