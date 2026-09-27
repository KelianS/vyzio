using NSubstitute;
using Vyzio.Application.DTOs.Cameras;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Tests.UseCases;

public class CameraStreamUseCaseTests
{
    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly ICameraCapabilityBindingRepository _bindings = Substitute.For<ICameraCapabilityBindingRepository>();
    private readonly ICameraVerifier _verifier = Substitute.For<ICameraVerifier>();
    private readonly ICameraProtocolProbe _protocols = CapabilityTestUseCases.AnsweringProbe();
    private readonly IFrigateConfigApplier _frigate = Substitute.For<IFrigateConfigApplier>();

    public CameraStreamUseCaseTests()
    {
        _verifier.VerifyAsync(Arg.Any<Camera>(), Arg.Any<CameraStream?>(), Arg.Any<CancellationToken>())
            .Returns(new CameraVerificationResult(true, true, "online", "Verified.", DateTimeOffset.UnixEpoch, DateTimeOffset.UnixEpoch));
    }

    private Camera GivenCamera()
    {
        var camera = new Camera
        {
            Id = "cam1",
            Slug = "porch",
            FrigateCameraName = "porch",
            DisplayName = "Porch",
            Host = "192.168.1.20",
        }.WithStream(SupportedProtocol.Rtsp, path: "/stream1");
        _cameras.GetByIdAsync(camera.Id, Arg.Any<CancellationToken>()).Returns(camera);
        _cameras.GetAllAsync(Arg.Any<CancellationToken>()).Returns([camera]);
        _bindings.GetAsync(camera.Id, CameraCapability.Stream, Arg.Any<CancellationToken>()).Returns(camera.StreamBinding);
        return camera;
    }

    private CameraProtocolCheck Check() => new(_protocols, TimeProvider.System);

    private AddCameraStreamUseCase AddUseCase()
        => new(_cameras, CapabilityTestUseCases.StreamRegistry(), Check(), _verifier, _frigate);

    private CheckCameraStreamUseCase CheckUseCase()
    {
        var enumerator = Substitute.For<ICameraStreamEnumerator>();
        enumerator.EnumerateAsync(Arg.Any<Camera>(), Arg.Any<CancellationToken>()).Returns([]);
        var verify = new VerifyCameraUseCase(_cameras, _bindings, _verifier, enumerator, Check(), TimeProvider.System);
        return new CheckCameraStreamUseCase(_cameras, verify, Check(), _verifier);
    }

    [Fact]
    public async Task Add_ShouldRefuse_WhenTheCameraHasNoRowForTheProtocol()
    {
        // Arrange
        var camera = GivenCamera();

        // Act
        var result = await AddUseCase().ExecuteAsync(camera.Id, new AddCameraStreamRequest("dvrip", null, "detect"));

        // Assert
        Assert.Equal(StreamOutcome.ProtocolNotOnCamera, result.Outcome);
        Assert.Single(camera.Streams);
    }

    [Fact]
    public async Task Add_ShouldCheckTheStreamAtOnceAndRewriteTheConfiguration_WhenItTakesARole()
    {
        // Arrange
        var camera = GivenCamera();

        // Act
        var result = await AddUseCase().ExecuteAsync(camera.Id, new AddCameraStreamRequest("rtsp", "stream2", "detect"));

        // Assert
        Assert.Equal(StreamOutcome.Done, result.Outcome);
        var added = camera.Streams.Single(stream => stream.Path == "/stream2");
        Assert.True(added.Verified);
        Assert.Equal(added.Id, result.Streams!.DetectStreamId);
        await _frigate.Received(1).WriteConfigAsync(Arg.Any<IReadOnlyList<Camera>>(), true, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task SetRole_ShouldRefuseAndChangeNothing_WhenTheRecordingStreamWouldStopRecording()
    {
        // Arrange
        var camera = GivenCamera();
        var useCase = new SetCameraStreamRoleUseCase(_cameras, _frigate);

        // Act
        var result = await useCase.ExecuteAsync(camera.Id, camera.MainStream!.Id, new SetCameraStreamRoleRequest("detect"));

        // Assert
        Assert.Equal(StreamOutcome.StreamRecords, result.Outcome);
        await _cameras.DidNotReceive().UpdateAsync(Arg.Any<Camera>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task SetRole_ShouldRefuse_WhenTheRoleIsUnknown()
    {
        // Arrange
        var camera = GivenCamera();
        var useCase = new SetCameraStreamRoleUseCase(_cameras, _frigate);

        // Act
        var result = await useCase.ExecuteAsync(camera.Id, camera.MainStream!.Id, new SetCameraStreamRoleRequest("archive"));

        // Assert
        Assert.Equal(StreamOutcome.UnknownRole, result.Outcome);
    }

    [Fact]
    public async Task SetEnabled_ShouldSayDetectionFallsBack_WhenTheDetectStreamIsDisabled()
    {
        // Arrange
        var camera = GivenCamera();
        var sub = StreamLineup.Add(camera.StreamBinding!, SupportedProtocol.Rtsp, "/stream2", StreamRole.Detect);
        var useCase = new SetCameraStreamEnabledUseCase(_cameras, _frigate);

        // Act
        var result = await useCase.ExecuteAsync(camera.Id, sub.Id, new SetCameraStreamEnabledRequest(false));

        // Assert
        Assert.Equal(StreamOutcome.Done, result.Outcome);
        Assert.True(result.Streams!.DetectsOnRecordingStream);
        await _frigate.Received(1).WriteConfigAsync(Arg.Any<IReadOnlyList<Camera>>(), true, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Remove_ShouldAnswerNotFound_WhenTheStreamIsNotTheCameras()
    {
        // Arrange
        var camera = GivenCamera();
        var useCase = new RemoveCameraStreamUseCase(_cameras, _frigate);

        // Act
        var result = await useCase.ExecuteAsync(camera.Id, "someone-else");

        // Assert
        Assert.Equal(StreamOutcome.StreamNotFound, result.Outcome);
    }

    [Fact]
    public async Task Check_ShouldFailTheStreamWithItsProtocolsReason_WhenTheProtocolDoesNotAnswer()
    {
        // Arrange
        var camera = GivenCamera();
        camera.EnsureProtocol(SupportedProtocol.Dvrip);
        var sub = StreamLineup.Add(camera.StreamBinding!, SupportedProtocol.Dvrip, "?channel=0&subtype=1", StreamRole.Detect);
        _protocols.ProbeAsync(camera, SupportedProtocol.Dvrip, Arg.Any<CancellationToken>())
            .Returns(ProtocolAnswer.Unreachable("no answer on port 34567"));

        // Act
        var result = await CheckUseCase().ExecuteAsync(camera.Id, sub.Id);

        // Assert
        Assert.Equal(StreamOutcome.Done, result.Outcome);
        Assert.False(sub.Verified);
        Assert.Equal("no answer on port 34567", sub.LastError);
        await _verifier.DidNotReceive().VerifyAsync(camera, sub, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Check_ShouldVerifyTheWholeCamera_WhenTheStreamRecords()
    {
        // Arrange
        var camera = GivenCamera();

        // Act
        await CheckUseCase().ExecuteAsync(camera.Id, camera.MainStream!.Id);

        // Assert
        Assert.Equal("online", camera.Status);
        Assert.True(camera.StreamBinding!.Verified);
    }
}
