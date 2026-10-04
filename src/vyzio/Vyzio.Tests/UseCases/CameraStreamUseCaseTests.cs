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

    private readonly ICameraStreamEnumerator _enumerator = Substitute.For<ICameraStreamEnumerator>();

    private CheckCameraStreamUseCase CheckUseCase()
    {
        var verify = new VerifyCameraUseCase(_cameras, _bindings, _verifier, _enumerator, Check(), TimeProvider.System);
        return new CheckCameraStreamUseCase(_cameras, verify, Check(), _verifier);
    }

    private ListAvailableCameraStreamsUseCase AvailableUseCase()
        => new(_cameras, CapabilityTestUseCases.StreamRegistry(), Check(), _enumerator);

    private void GivenTheCameraServes(SupportedProtocol protocol, params EnumeratedStream[] streams)
        => _enumerator.EnumerateAsync(Arg.Any<Camera>(), protocol, Arg.Any<CancellationToken>())
            .Returns([new EnumeratedScene("scene", streams)]);

    [Fact]
    public async Task ListAvailable_ShouldOfferWhatTheCameraServes_WhenTheProtocolAnswers()
    {
        // Arrange
        var camera = GivenCamera();
        GivenTheCameraServes(SupportedProtocol.Rtsp, new("/stream1", 1920, 1080, 15), new("/stream2", 640, 360, 15));

        // Act
        var result = await AvailableUseCase().ExecuteAsync(camera.Id, "rtsp");

        // Assert
        Assert.Equal(StreamOutcome.Done, result.Outcome);
        Assert.Equal(["/stream1", "/stream2"], result.Streams!.Select(offer => offer.Path));
        Assert.Equal(camera.Streams.First().Id, result.Streams![0].StreamId);
        Assert.Null(result.Streams![1].StreamId);
    }

    [Fact]
    public async Task ListAvailable_ShouldOfferWhatTheCameraServes_WhenItsStreamIsNotConfiguredYet()
    {
        // Arrange
        var camera = new Camera { Id = "cam1", Slug = "porch", FrigateCameraName = "porch", DisplayName = "Porch", Host = "192.168.1.20" };
        camera.EnsureProtocol(SupportedProtocol.Rtsp);
        _cameras.GetByIdAsync(camera.Id, Arg.Any<CancellationToken>()).Returns(camera);
        GivenTheCameraServes(SupportedProtocol.Rtsp, new EnumeratedStream("/stream1", 1920, 1080, 15));

        // Act
        var result = await AvailableUseCase().ExecuteAsync(camera.Id, "rtsp");

        // Assert
        Assert.Equal(StreamOutcome.Done, result.Outcome);
        Assert.Null(Assert.Single(result.Streams!).StreamId);
    }

    [Fact]
    public async Task ListAvailable_ShouldAskTheCameraNothing_WhenTheProtocolDoesNotAnswer()
    {
        // Arrange
        var camera = GivenCamera();
        GivenTheCameraServes(SupportedProtocol.Rtsp, new EnumeratedStream("/stream2", 640, 360, 15));
        _protocols.ProbeAsync(camera, SupportedProtocol.Rtsp, Arg.Any<CancellationToken>())
            .Returns(ProtocolAnswer.Unreachable("no answer on port 554"));

        // Act
        var result = await AvailableUseCase().ExecuteAsync(camera.Id, "rtsp");

        // Assert
        Assert.Empty(result.Streams!);
        Assert.Equal("no answer on port 554", camera.Protocol(SupportedProtocol.Rtsp)!.LastError);
        await _enumerator.DidNotReceive().EnumerateAsync(Arg.Any<Camera>(), Arg.Any<SupportedProtocol>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ListAvailable_ShouldOfferBothDvripQualities_WhenTheCameraListsNone()
    {
        // Arrange
        var camera = GivenCamera();
        camera.EnsureProtocol(SupportedProtocol.Dvrip);
        _enumerator.EnumerateAsync(Arg.Any<Camera>(), SupportedProtocol.Dvrip, Arg.Any<CancellationToken>()).Returns([]);

        // Act
        var result = await AvailableUseCase().ExecuteAsync(camera.Id, "dvrip");

        // Assert
        Assert.Equal([null, CameraStream.DvripSecondaryQuery], result.Streams!.Select(offer => offer.Path));
    }

    [Fact]
    public async Task ListAvailable_ShouldStillOfferBothDvripQualities_WhenTheProtocolDoesNotAnswer()
    {
        // Arrange
        var camera = GivenCamera();
        camera.EnsureProtocol(SupportedProtocol.Dvrip);
        _protocols.ProbeAsync(camera, SupportedProtocol.Dvrip, Arg.Any<CancellationToken>())
            .Returns(ProtocolAnswer.Unreachable("no answer on port 34567"));

        // Act
        var result = await AvailableUseCase().ExecuteAsync(camera.Id, "dvrip");

        // Assert
        Assert.Equal([null, CameraStream.DvripSecondaryQuery], result.Streams!.Select(offer => offer.Path));
        await _enumerator.DidNotReceive().EnumerateAsync(Arg.Any<Camera>(), Arg.Any<SupportedProtocol>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ListAvailable_ShouldRefuse_WhenTheCameraHasNoRowForTheProtocol()
    {
        // Arrange
        var camera = GivenCamera();

        // Act
        var result = await AvailableUseCase().ExecuteAsync(camera.Id, "dvrip");

        // Assert
        Assert.Equal(StreamOutcome.ProtocolNotOnCamera, result.Outcome);
        await _protocols.DidNotReceive().ProbeAsync(Arg.Any<Camera>(), Arg.Any<SupportedProtocol>(), Arg.Any<CancellationToken>());
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
    public async Task Add_ShouldAskForTheSecondaryStreamByItsQuery_WhenADvripStreamIsTheSecondaryOne()
    {
        // Arrange
        var camera = GivenCamera();
        camera.EnsureProtocol(SupportedProtocol.Dvrip);

        // Act
        await AddUseCase().ExecuteAsync(camera.Id, new AddCameraStreamRequest("dvrip", CameraStream.DvripSecondaryQuery, "none"));

        // Assert
        var added = camera.Streams.Single(stream => stream.Protocol == SupportedProtocol.Dvrip);
        Assert.Equal(CameraStream.DvripSecondaryQuery, added.Path);
    }

    [Fact]
    public async Task Add_ShouldRefuse_WhenADvripStreamIsATypedPath()
    {
        // Arrange
        var camera = GivenCamera();
        camera.EnsureProtocol(SupportedProtocol.Dvrip);

        // Act
        var result = await AddUseCase().ExecuteAsync(camera.Id, new AddCameraStreamRequest("dvrip", "/typed", "none"));

        // Assert
        Assert.Equal(StreamOutcome.UnknownPath, result.Outcome);
        Assert.Single(camera.Streams);
    }

    [Fact]
    public async Task Add_ShouldRefuse_WhenAnRtspStreamHasNoPath()
    {
        // Arrange
        var camera = GivenCamera();

        // Act
        var result = await AddUseCase().ExecuteAsync(camera.Id, new AddCameraStreamRequest("rtsp", "  ", "none"));

        // Assert
        Assert.Equal(StreamOutcome.PathRequired, result.Outcome);
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
        var result = await useCase.ExecuteAsync(camera.Id, camera.Streams.First().Id, new SetCameraStreamRoleRequest("detect"));

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
        var result = await useCase.ExecuteAsync(camera.Id, camera.Streams.First().Id, new SetCameraStreamRoleRequest("archive"));

        // Assert
        Assert.Equal(StreamOutcome.UnknownRole, result.Outcome);
    }

    [Fact]
    public async Task Remove_ShouldSayDetectionFallsBack_WhenTheDetectStreamIsRemoved()
    {
        // Arrange
        var camera = GivenCamera();
        var sub = StreamLineup.Add(camera.StreamBinding!, SupportedProtocol.Rtsp, "/stream2", StreamRole.Detect);
        var useCase = new RemoveCameraStreamUseCase(_cameras, _frigate);

        // Act
        var result = await useCase.ExecuteAsync(camera.Id, sub.Id);

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
        await CheckUseCase().ExecuteAsync(camera.Id, camera.Streams.First().Id);

        // Assert
        Assert.Equal("online", camera.Status);
        Assert.True(camera.StreamBinding!.Verified);
    }
}
