using NSubstitute;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Tests.UseCases;

public class CameraProtocolLevelTests
{
    private static Camera MakeCamera() => new()
    {
        Id = "cam1",
        Slug = "cam1",
        FrigateCameraName = "cam1",
        DisplayName = "cam1",
        Host = "192.168.1.10",
        Username = "local",
        Password = "local-secret",
    };

    [Fact]
    public void CredentialsFor_ShouldGiveTheProtocolsSpecificAccount_WhenTheProtocolHasOne()
    {
        // Arrange
        var camera = MakeCamera();
        var klap = camera.EnsureProtocol(SupportedProtocol.TapoKlap);
        klap.Username = "cloud";
        klap.Password = "cloud-secret";

        // Act
        var account = camera.CredentialsFor(SupportedProtocol.TapoKlap);

        // Assert
        Assert.Equal(new CameraCredentials("cloud", "cloud-secret"), account);
    }

    [Fact]
    public void CredentialsFor_ShouldGiveTheCamerasAccount_WhenTheProtocolHasNoneOfItsOwn()
    {
        // Arrange
        var camera = MakeCamera();
        camera.EnsureProtocol(SupportedProtocol.Rtsp);

        // Act
        var account = camera.CredentialsFor(SupportedProtocol.Rtsp);

        // Assert
        Assert.Equal(new CameraCredentials("local", "local-secret"), account);
    }

    [Theory]
    [InlineData(SupportedProtocol.Rtsp, 554)]
    [InlineData(SupportedProtocol.Dvrip, 34567)]
    [InlineData(SupportedProtocol.V380, 8800)]
    [InlineData(SupportedProtocol.TapoKlap, 80)]
    public void PortOf_ShouldGiveTheUsualPort_WhenNoPortWasSetForTheProtocol(SupportedProtocol protocol, int expected)
    {
        // Arrange
        var camera = MakeCamera();

        // Act
        var port = camera.PortOf(protocol);

        // Assert
        Assert.Equal(expected, port);
    }

    [Fact]
    public void PortOf_ShouldGiveTheSetPort_WhenTheProtocolHasOne()
    {
        // Arrange
        var camera = MakeCamera();
        camera.EnsureProtocol(SupportedProtocol.Rtsp).Port = 8554;

        // Act
        var port = camera.PortOf(SupportedProtocol.Rtsp);

        // Assert
        Assert.Equal(8554, port);
    }
}

public class GetCameraProtocolsUseCaseTests
{
    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();

    [Fact]
    public async Task ExecuteAsync_ShouldListTheStreamProtocolFirst_WhenTheCameraSpeaksSeveral()
    {
        // Arrange
        var camera = new Camera { Id = "cam1", Slug = "cam1", FrigateCameraName = "cam1", DisplayName = "cam1", Host = "h" }
            .WithStream(SupportedProtocol.Dvrip);
        camera.EnsureProtocol(SupportedProtocol.Onvif).Endpoint = "http://h:8899/onvif/device_service";
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        var sut = new GetCameraProtocolsUseCase(_cameras);

        // Act
        var result = await sut.ExecuteAsync("cam1");

        // Assert
        Assert.Equal(["dvrip", "onvif"], result!.Select(p => p.Protocol));
        Assert.Equal(34567, result![0].EffectivePort);
        Assert.Equal(8899, result[1].EffectivePort);
    }
}

public class CheckCameraProtocolUseCaseTests
{
    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly ICameraProtocolProbe _probe = Substitute.For<ICameraProtocolProbe>();

    [Fact]
    public async Task ExecuteAsync_ShouldRecordThatTheProtocolIsUnreachable_WhenTheCameraStaysSilent()
    {
        // Arrange
        var camera = new Camera { Id = "cam1", Slug = "cam1", FrigateCameraName = "cam1", DisplayName = "cam1", Host = "h" };
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _probe.ProbeAsync(camera, SupportedProtocol.V380, Arg.Any<CancellationToken>())
            .Returns(ProtocolAnswer.Unreachable("V380: no answer on h:8800 within 3 s."));
        var sut = new CheckCameraProtocolUseCase(_cameras, new CameraProtocolCheck(_probe, TimeProvider.System));

        // Act
        var result = await sut.ExecuteAsync("cam1", SupportedProtocol.V380);

        // Assert
        Assert.Equal("unreachable", result!.Status);
        Assert.Equal("V380: no answer on h:8800 within 3 s.", result.LastError);
        await _cameras.Received(1).UpdateAsync(camera, Arg.Any<CancellationToken>());
    }
}

public class UpdateCameraProtocolUseCaseTests
{
    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly ICameraProtocolEndpointCache _endpointCache = Substitute.For<ICameraProtocolEndpointCache>();
    private readonly IFrigateConfigApplier _frigate = Substitute.For<IFrigateConfigApplier>();
    private readonly UpdateCameraProtocolUseCase _sut;

    public UpdateCameraProtocolUseCaseTests()
    {
        _cameras.GetAllAsync(Arg.Any<CancellationToken>()).Returns([]);
        _sut = new UpdateCameraProtocolUseCase(_cameras, _endpointCache, _frigate, TimeProvider.System);
    }

    private Camera GivenValidatedCamera()
    {
        var camera = new Camera
        {
            Id = "cam1",
            Slug = "cam1",
            FrigateCameraName = "cam1",
            DisplayName = "cam1",
            Host = "h",
            Status = "online",
            ValidationState = CameraValidationState.Validated,
            IsEnabled = true,
        }.WithStream(SupportedProtocol.Rtsp);
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        return camera;
    }

    [Fact]
    public async Task ExecuteAsync_ShouldStoreNoPort_WhenTheUsualPortIsGiven()
    {
        // Arrange
        var camera = GivenValidatedCamera();
        camera.Protocol(SupportedProtocol.Rtsp)!.Port = 8554;

        // Act
        await _sut.ExecuteAsync("cam1", SupportedProtocol.Rtsp, new UpdateCameraProtocolRequest(554, null, null, null));

        // Assert
        Assert.Null(camera.Protocol(SupportedProtocol.Rtsp)!.Port);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldSendTheCameraBackToBeChecked_WhenTheStreamProtocolPortChanges()
    {
        // Arrange
        var camera = GivenValidatedCamera();

        // Act
        await _sut.ExecuteAsync("cam1", SupportedProtocol.Rtsp, new UpdateCameraProtocolRequest(8554, null, null, null));

        // Assert
        Assert.Equal(CameraValidationState.Draft, camera.ValidationState);
        Assert.Equal("needs_attention", camera.Status);
        await _frigate.Received(1).WriteConfigAsync(Arg.Any<IReadOnlyList<Camera>>(), changed: true, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldLeaveSurveillanceAlone_WhenAnotherProtocolGetsItsSpecificAccount()
    {
        // Arrange
        var camera = GivenValidatedCamera();

        // Act
        var result = await _sut.ExecuteAsync("cam1", SupportedProtocol.TapoKlap, new UpdateCameraProtocolRequest(null, "cloud", "cloud-secret", null));

        // Assert
        Assert.True(result!.HasSpecificAccount);
        Assert.Equal(new CameraCredentials("cloud", "cloud-secret"), camera.CredentialsFor(SupportedProtocol.TapoKlap));
        Assert.Equal(CameraValidationState.Validated, camera.ValidationState);
        await _frigate.DidNotReceive().WriteConfigAsync(Arg.Any<IReadOnlyList<Camera>>(), Arg.Any<bool>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldKeepTheOwnPassword_WhenNoNewOneIsGiven()
    {
        // Arrange
        var camera = GivenValidatedCamera();
        var klap = camera.EnsureProtocol(SupportedProtocol.TapoKlap);
        klap.Username = "cloud";
        klap.Password = "cloud-secret";

        // Act
        await _sut.ExecuteAsync("cam1", SupportedProtocol.TapoKlap, new UpdateCameraProtocolRequest(null, "cloud", null, null));

        // Assert
        Assert.Equal("cloud-secret", klap.Password);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldDropTheSpecificAccount_WhenTheUserNameIsEmptied()
    {
        // Arrange
        var camera = GivenValidatedCamera();
        var klap = camera.EnsureProtocol(SupportedProtocol.TapoKlap);
        klap.Username = "cloud";
        klap.Password = "cloud-secret";

        // Act
        await _sut.ExecuteAsync("cam1", SupportedProtocol.TapoKlap, new UpdateCameraProtocolRequest(null, "", null, null));

        // Assert
        Assert.Null(klap.Username);
        Assert.Null(klap.Password);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldForgetWhereOnvifAnswered_WhenItsPortIsSetByHand()
    {
        // Arrange
        var camera = GivenValidatedCamera();
        camera.EnsureProtocol(SupportedProtocol.Onvif).Endpoint = "http://h:8899/onvif/device_service";

        // Act
        await _sut.ExecuteAsync("cam1", SupportedProtocol.Onvif, new UpdateCameraProtocolRequest(2020, null, null, null));

        // Assert
        Assert.Null(camera.Protocol(SupportedProtocol.Onvif)!.Endpoint);
        _endpointCache.Received(1).Forget("cam1");
    }

    [Fact]
    public async Task ExecuteAsync_ShouldKeepTheTypedDeviceNumber_WhenTheV380BoxIsSaved()
    {
        // Arrange
        var camera = GivenValidatedCamera();

        // Act
        await _sut.ExecuteAsync("cam1", SupportedProtocol.V380, new UpdateCameraProtocolRequest(null, null, null, 26970853));

        // Assert
        Assert.Equal(26970853u, camera.Protocol(SupportedProtocol.V380)!.DeviceId);
    }
}

public class SetStreamPathUseCaseTests
{
    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly ICameraCapabilityBindingRepository _bindings = Substitute.For<ICameraCapabilityBindingRepository>();
    private readonly IFrigateConfigApplier _frigate = Substitute.For<IFrigateConfigApplier>();

    [Fact]
    public async Task ExecuteAsync_ShouldSendTheCameraBackToBeChecked_WhenTheMainPathChanges()
    {
        // Arrange
        var camera = new Camera
        {
            Id = "cam1",
            Slug = "cam1",
            FrigateCameraName = "cam1",
            DisplayName = "cam1",
            Host = "h",
            Status = "online",
            ValidationState = CameraValidationState.Validated,
            IsEnabled = true,
        }.WithStream(SupportedProtocol.Rtsp, path: "/stream1");
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        _cameras.GetAllAsync(Arg.Any<CancellationToken>()).Returns([]);
        _bindings.GetAsync("cam1", CameraCapability.Stream, Arg.Any<CancellationToken>()).Returns(camera.StreamBinding);
        var sut = new SetStreamPathUseCase(_cameras, _bindings, _frigate);

        // Act
        var result = await sut.ExecuteAsync("cam1", "stream2");

        // Assert
        Assert.Equal("/stream2", result!.StreamPath);
        Assert.Equal(CameraValidationState.Draft, camera.ValidationState);
        await _frigate.Received(1).WriteConfigAsync(Arg.Any<IReadOnlyList<Camera>>(), changed: true, Arg.Any<CancellationToken>());
    }
}

public class AddCameraProtocolUseCaseTests
{
    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly ICameraProtocolProbe _probe = CapabilityTestUseCases.AnsweringProbe();
    private readonly AddCameraProtocolUseCase _sut;

    public AddCameraProtocolUseCaseTests()
        => _sut = new AddCameraProtocolUseCase(_cameras, new CameraProtocolCheck(_probe, TimeProvider.System), TimeProvider.System);

    private Camera GivenCamera()
    {
        var camera = new Camera { Id = "cam1", Slug = "cam1", FrigateCameraName = "cam1", DisplayName = "cam1", Host = "h" }
            .WithStream(SupportedProtocol.Rtsp);
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        return camera;
    }

    [Fact]
    public async Task ExecuteAsync_ShouldAddTheProtocolAndCheckItAtOnce_WhenTheCameraDoesNotSpeakItYet()
    {
        // Arrange
        var camera = GivenCamera();

        // Act
        var result = await _sut.ExecuteAsync("cam1", new AddCameraProtocolRequest("tapo_klap", 8080, "cloud", "cloud-secret"));

        // Assert
        Assert.Equal(AddProtocolOutcome.Added, result.Outcome);
        Assert.Equal("answers", result.Protocol!.Status);
        Assert.Equal(8080, camera.Protocol(SupportedProtocol.TapoKlap)!.Port);
        Assert.Equal(new CameraCredentials("cloud", "cloud-secret"), camera.CredentialsFor(SupportedProtocol.TapoKlap));
        await _cameras.Received(1).UpdateAsync(camera, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldStoreNoPort_WhenTheUsualPortIsGiven()
    {
        // Arrange
        var camera = GivenCamera();

        // Act
        await _sut.ExecuteAsync("cam1", new AddCameraProtocolRequest("dvrip", 34567, null, null));

        // Assert
        Assert.Null(camera.Protocol(SupportedProtocol.Dvrip)!.Port);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldRefuse_WhenTheCameraAlreadySpeaksTheProtocol()
    {
        // Arrange
        GivenCamera();

        // Act
        var result = await _sut.ExecuteAsync("cam1", new AddCameraProtocolRequest("rtsp", null, null, null));

        // Assert
        Assert.Equal(AddProtocolOutcome.AlreadySpoken, result.Outcome);
        await _cameras.DidNotReceive().UpdateAsync(Arg.Any<Camera>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldRefuse_WhenTheProtocolIsUnknown()
    {
        // Arrange
        GivenCamera();

        // Act
        var result = await _sut.ExecuteAsync("cam1", new AddCameraProtocolRequest("telnet", null, null, null));

        // Assert
        Assert.Equal(AddProtocolOutcome.UnknownProtocol, result.Outcome);
    }
}

public class RemoveCameraProtocolUseCaseTests
{
    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly ICameraProtocolEndpointCache _endpointCache = Substitute.For<ICameraProtocolEndpointCache>();
    private readonly RemoveCameraProtocolUseCase _sut;

    public RemoveCameraProtocolUseCaseTests() => _sut = new RemoveCameraProtocolUseCase(_cameras, _endpointCache);

    private Camera GivenCamera()
    {
        var camera = new Camera { Id = "cam1", Slug = "cam1", FrigateCameraName = "cam1", DisplayName = "cam1", Host = "h" }
            .WithStream(SupportedProtocol.Rtsp);
        camera.EnsureProtocol(SupportedProtocol.Onvif);
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(camera);
        return camera;
    }

    [Fact]
    public async Task ExecuteAsync_ShouldRemoveTheProtocolAndForgetWhereItAnswered_WhenNoCapabilityUsesIt()
    {
        // Arrange
        var camera = GivenCamera();

        // Act
        var outcome = await _sut.ExecuteAsync("cam1", SupportedProtocol.Onvif);

        // Assert
        Assert.Equal(RemoveProtocolOutcome.Removed, outcome);
        Assert.Null(camera.Protocol(SupportedProtocol.Onvif));
        _endpointCache.Received(1).Forget("cam1");
        await _cameras.Received(1).UpdateAsync(camera, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldRefuse_WhenACapabilityGoesThroughTheProtocol()
    {
        // Arrange
        var camera = GivenCamera();

        // Act
        var outcome = await _sut.ExecuteAsync("cam1", SupportedProtocol.Rtsp);

        // Assert
        Assert.Equal(RemoveProtocolOutcome.InUse, outcome);
        Assert.NotNull(camera.Protocol(SupportedProtocol.Rtsp));
        await _cameras.DidNotReceive().UpdateAsync(Arg.Any<Camera>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldSayNotFound_WhenTheCameraDoesNotSpeakTheProtocol()
    {
        // Arrange
        GivenCamera();

        // Act
        var outcome = await _sut.ExecuteAsync("cam1", SupportedProtocol.V380);

        // Assert
        Assert.Equal(RemoveProtocolOutcome.NotFound, outcome);
    }
}
