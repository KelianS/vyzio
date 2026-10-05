using System.Globalization;
using NSubstitute;
using Vyzio.Application.DTOs.Cameras;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Tests.UseCases;

public class GetCamerasUseCaseTests
{
    private readonly ICameraRepository _repo = Substitute.For<ICameraRepository>();
    private readonly ICameraCapabilityBindingRepository _bindings = Substitute.For<ICameraCapabilityBindingRepository>();
    private readonly GetCamerasUseCase _sut;

    public GetCamerasUseCaseTests()
    {
        _bindings.GetAllVerifiedAsync(Arg.Any<CancellationToken>()).Returns([]);
        _sut = new GetCamerasUseCase(_repo, _bindings);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldProjectEachCameraWithItsStatus_WhenACameraIsValidatedAndOnline()
    {
        _repo.GetAllAsync(Arg.Any<CancellationToken>()).Returns(
        [
            new Camera
            {
                Slug = "front-door",
                FrigateCameraName = "front_door",
                DisplayName = "Front Door",
                Host = "192.168.1.10",
                Status = "online",
                ValidationState = CameraValidationState.Validated,
                IsEnabled = true,
                LastSuccessfulFrameAt = DateTimeOffset.Parse("2026-05-12T09:00:00+00:00", CultureInfo.InvariantCulture)
            }
        ]);

        var result = await _sut.ExecuteAsync();

        var camera = Assert.Single(result);
        Assert.Equal("Front Door", camera.DisplayName);
        Assert.True(camera.PreviewAvailable);
        Assert.False(camera.NeedsAttention);
        Assert.Empty(camera.VerifiedCapabilities);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldListTheVerifiedCapabilities_WhenTheCameraHasAVerifiedBinding()
    {
        var cameraId = "cam-1";
        _repo.GetAllAsync(Arg.Any<CancellationToken>()).Returns(
        [
            new Camera { Id = cameraId, Slug = "garage", FrigateCameraName = "garage", DisplayName = "Garage", Host = "192.168.1.11", Status = "online", ValidationState = CameraValidationState.Validated, IsEnabled = true }
        ]);
        _bindings.GetAllVerifiedAsync(Arg.Any<CancellationToken>()).Returns(
        [
            new CameraCapabilityBinding { CameraId = cameraId, Capability = CameraCapability.Ptz, Protocol = SupportedProtocol.Onvif, Status = CapabilityStatus.Verified }
        ]);

        var result = await _sut.ExecuteAsync();

        var camera = Assert.Single(result);
        Assert.Contains("ptz", camera.VerifiedCapabilities);
    }
}

public class GetCameraStatusUseCaseTests
{
    private readonly ICameraRepository _repo = Substitute.For<ICameraRepository>();
    private readonly GetCameraStatusUseCase _sut;

    public GetCameraStatusUseCaseTests() => _sut = new GetCameraStatusUseCase(_repo);

    [Fact]
    public async Task ExecuteAsync_ShouldReturnGuidance_WhenTheCameraIsADraft()
    {
        var camera = new Camera
        {
            Id = "camera-1",
            Slug = "garage",
            FrigateCameraName = "garage",
            DisplayName = "Garage",
            Host = "192.168.1.11",
            ValidationState = CameraValidationState.Draft,
            Status = "needs_attention"
        }.WithStream(SupportedProtocol.Rtsp, path: "/stream1");

        _repo.GetByIdAsync(camera.Id, Arg.Any<CancellationToken>()).Returns(camera);

        var result = await _sut.ExecuteAsync(camera.Id);

        Assert.NotNull(result);
        Assert.True(result!.NeedsAttention);
        Assert.Equal("Configuration incomplete. Verifiez le flux avant d'appliquer la configuration.", result.Guidance);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldAskToChooseHowTheStreamIsRead_WhenTheDraftCameraHasNoStreamBinding()
    {
        // Arrange
        var camera = new Camera
        {
            Id = "camera-2",
            Slug = "porch",
            FrigateCameraName = "porch",
            DisplayName = "Porch",
            Host = "192.168.1.12",
            ValidationState = CameraValidationState.Draft,
        };
        _repo.GetByIdAsync(camera.Id, Arg.Any<CancellationToken>()).Returns(camera);

        // Act
        var result = await _sut.ExecuteAsync(camera.Id);

        // Assert
        Assert.Equal("Configuration incomplete. Choisissez comment Vyzio lit le flux video, puis lancez la verification.", result!.Guidance);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldReadToSetUpInPlaceOfAConfigurationError_WhenTheStreamNeverWorked()
    {
        // Arrange
        var camera = new Camera
        {
            Id = "camera-3",
            Slug = "shed",
            FrigateCameraName = "shed",
            DisplayName = "Shed",
            Host = "192.168.1.13",
            ValidationState = CameraValidationState.ToSetUp,
            Status = "config_error",
        };
        _repo.GetByIdAsync(camera.Id, Arg.Any<CancellationToken>()).Returns(camera);

        // Act
        var result = await _sut.ExecuteAsync(camera.Id);

        // Assert
        Assert.Equal("to_set_up", result!.Status);
        Assert.Equal("to_set_up", result.ValidationState);
        Assert.False(result.Connected);
        Assert.True(result.NeedsAttention);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldReturnNull_WhenTheCameraDoesNotExist()
    {
        _repo.GetByIdAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns((Camera?)null);

        var result = await _sut.ExecuteAsync("unknown");

        Assert.Null(result);
    }
}

public class DiscoverCamerasUseCaseTests
{
    private readonly ICameraDiscoveryService _discovery = Substitute.For<ICameraDiscoveryService>();
    private readonly ICameraRepository _repo = Substitute.For<ICameraRepository>();
    private readonly DiscoverCamerasUseCase _sut;

    public DiscoverCamerasUseCaseTests() => _sut = new DiscoverCamerasUseCase(_discovery, _repo);

    [Fact]
    public async Task ExecuteAsync_ShouldReturnTheDiscoveredCandidates_WhenNoCameraIsConfiguredYet()
    {
        _repo.GetAllAsync(Arg.Any<CancellationToken>()).Returns([]);
        _discovery.DiscoverAsync(null, null, Arg.Any<CancellationToken>()).Returns(
        [
            new CameraDiscoveryCandidate("Driveway", "192.168.1.20", 554, "onvif", null, "onvif", "ONVIF device announced.", "camera_confirmed", null, ["onvif_detected"])
        ]);

        var result = await _sut.ExecuteAsync();

        var candidate = Assert.Single(result);
        Assert.Equal("Driveway", candidate.DisplayName);
        Assert.Equal("192.168.1.20", candidate.Host);
        Assert.Equal("camera_confirmed", candidate.Qualification);
        Assert.Contains("onvif_detected", candidate.QualificationReasons);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldLeaveOutACandidate_WhenItIsAlreadyConfigured()
    {
        _repo.GetAllAsync(Arg.Any<CancellationToken>()).Returns(
        [
            new Camera
            {
                Id = "camera-1",
                Slug = "front-door",
                FrigateCameraName = "front_door",
                DisplayName = "Front Door",
                Host = "192.168.1.10",
            }.WithStream(SupportedProtocol.Rtsp)
        ]);

        _discovery.DiscoverAsync(null, null, Arg.Any<CancellationToken>()).Returns(
        [
            new CameraDiscoveryCandidate("Front Door", "192.168.1.10", 554, "onvif", null, "onvif", null, "camera_confirmed", null, []),
            new CameraDiscoveryCandidate("Driveway", "192.168.1.20", 554, "onvif", null, "onvif", null, "camera_confirmed", null, [])
        ]);

        var result = await _sut.ExecuteAsync();

        var candidate = Assert.Single(result);
        Assert.Equal("Driveway", candidate.DisplayName);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldLeaveOutACandidate_WhenItsAddressBelongsToACameraWithoutAStream()
    {
        // Arrange
        _repo.GetAllAsync(Arg.Any<CancellationToken>()).Returns(
        [
            new Camera
            {
                Id = "camera-1",
                Slug = "front-door",
                FrigateCameraName = "front_door",
                DisplayName = "Front Door",
                Host = "192.168.1.10",
                ValidationState = CameraValidationState.ToSetUp,
            }
        ]);
        _discovery.DiscoverAsync(null, null, Arg.Any<CancellationToken>()).Returns(
        [
            new CameraDiscoveryCandidate("Front Door", "192.168.1.10", 34567, "dvrip", null, "dvrip", null, "camera_confirmed", null, []),
            new CameraDiscoveryCandidate("Driveway", "192.168.1.20", 554, "onvif", null, "onvif", null, "camera_confirmed", null, [])
        ]);

        // Act
        var result = await _sut.ExecuteAsync();

        // Assert
        var candidate = Assert.Single(result);
        Assert.Equal("Driveway", candidate.DisplayName);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldRefreshTheTargetedCandidateEvenIfConfigured_WhenAHostIsTargeted()
    {
        _repo.GetAllAsync(Arg.Any<CancellationToken>()).Returns(
        [
            new Camera
            {
                Id = "camera-1",
                Slug = "front-door",
                FrigateCameraName = "front_door",
                DisplayName = "Front Door",
                Host = "192.168.1.10",
            }
        ]);

        _discovery.DiscoverAsync(Arg.Any<CameraDiscoveryTarget>(), Arg.Any<string?>(), Arg.Any<CancellationToken>()).Returns(
        [
            new CameraDiscoveryCandidate("Front Door", "192.168.1.10", 554, "onvif", "/Streaming/Channels/101", "rtsp_describe", null, "camera_confirmed", null, ["rtsp_responding"])
        ]);

        var result = await _sut.ExecuteAsync(new DiscoverCamerasRequest("192.168.1.10", 554));

        var candidate = Assert.Single(result);
        Assert.Equal("Front Door", candidate.DisplayName);
        Assert.True(candidate.RtspActive);
        await _discovery.Received(1).DiscoverAsync(
            Arg.Is<CameraDiscoveryTarget>(target => target.Host == "192.168.1.10" && target.Port == 554),
            Arg.Any<string?>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldHandTheDashboardHostToTheSweep_WhenItIsGiven()
    {
        // Arrange
        _repo.GetAllAsync(Arg.Any<CancellationToken>()).Returns([]);
        _discovery.DiscoverAsync(null, "192.168.1.20", Arg.Any<CancellationToken>()).Returns([]);

        // Act
        await _sut.ExecuteAsync(dashboardHost: "192.168.1.20");

        // Assert
        await _discovery.Received(1).DiscoverAsync(null, "192.168.1.20", Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldNameTheVendor_WhenTheCandidateProvesIt()
    {
        // Arrange
        _repo.GetAllAsync(Arg.Any<CancellationToken>()).Returns([]);
        _discovery.DiscoverAsync(null, null, Arg.Any<CancellationToken>()).Returns(
        [
            new CameraDiscoveryCandidate("Camera", "192.168.1.30", 8800, "rtsp_manual", null, "port_scan", null, "camera_confirmed", VendorFamily.V380Pro, ["camera_port_open"])
        ]);

        // Act
        var result = await _sut.ExecuteAsync();

        // Assert
        Assert.Equal("v380_pro", Assert.Single(result).VendorFamily);
    }
}

public class GetDiscoveryRangesUseCaseTests
{
    private readonly ICameraDiscoveryService _discovery = Substitute.For<ICameraDiscoveryService>();
    private readonly GetDiscoveryRangesUseCase _sut;

    public GetDiscoveryRangesUseCaseTests() => _sut = new GetDiscoveryRangesUseCase(_discovery);

    [Fact]
    public async Task Execute_ShouldReturnTheRangesToSweepWithTheirSourceWithoutProbing_WhenTheDashboardHostIsGiven()
    {
        // Arrange
        _discovery.RangesToSweep("192.168.1.20").Returns(
            [new DiscoveryRange("192.168.1.0/24", "192.168.1.1", "192.168.1.254", DiscoveryRangeSource.DashboardAddress)]);

        // Act
        var result = _sut.Execute("192.168.1.20");

        // Assert
        Assert.Equal(new DiscoveryRangeDto("192.168.1.0/24", "192.168.1.1", "192.168.1.254", "dashboard_address"), Assert.Single(result));
        await _discovery.DidNotReceiveWithAnyArgs().DiscoverAsync(default, default, default);
    }
}

public class GetVendorAssistanceUseCaseTests
{
    private readonly IVendorAssistanceService _vendorAssistance = Substitute.For<IVendorAssistanceService>();
    private readonly GetVendorAssistanceUseCase _sut;

    public GetVendorAssistanceUseCaseTests() => _sut = new GetVendorAssistanceUseCase(_vendorAssistance);

    [Fact]
    public async Task ExecuteAsync_ShouldReturnTheMarkdown_WhenTheVendorNeedsRtspAssistance()
    {
        _vendorAssistance.GetAssistanceAsync("v380_pro", Arg.Any<CancellationToken>())
            .Returns(new VendorDocumentation("v380_pro", "# V380 PRO\n\nNotice RTSP de test."));

        var result = await _sut.ExecuteAsync(new VendorAssistanceRequestDto("v380_pro"));

        Assert.NotNull(result);
        Assert.Equal("v380_pro", result!.VendorFamily);
        Assert.Contains("# V380 PRO", result.Markdown);
    }
}

public class CreateCameraUseCaseTests
{
    private readonly ICameraRepository _repo = Substitute.For<ICameraRepository>();
    private readonly CreateCameraUseCase _sut;

    public CreateCameraUseCaseTests() => _sut = new CreateCameraUseCase(_repo);

    [Fact]
    public async Task ExecuteAsync_ShouldCreateADisabledCameraToSetUpWithASlug_WhenTheSlugIsFree()
    {
        // Arrange
        _repo.GetBySlugAsync("front-door", Arg.Any<CancellationToken>()).Returns((Camera?)null);

        // Act
        var result = await _sut.ExecuteAsync(new CreateCameraRequest("Front Door", "192.168.1.10", null, null));

        // Assert
        Assert.Equal("front-door", result.Slug);
        Assert.Equal("to_set_up", result.Status);
        Assert.Null(result.DetectedAt);
        await _repo.Received(1).AddAsync(Arg.Is<Camera>(camera =>
            camera.DisplayName == "Front Door"
            && camera.ValidationState == CameraValidationState.ToSetUp
            && camera.IsEnabled == false), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldKeepTheAccessAndNothingElse_WhenTheCameraIsCreated()
    {
        // Arrange
        _repo.GetBySlugAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns((Camera?)null);
        Camera? added = null;
        await _repo.AddAsync(Arg.Do<Camera>(camera => added = camera), Arg.Any<CancellationToken>());

        // Act
        await _sut.ExecuteAsync(new CreateCameraRequest("Garage", " 192.168.1.20 ", " viewer ", " fixture-secret "));

        // Assert
        Assert.Equal("192.168.1.20", added!.Host);
        Assert.Equal("viewer", added.Username);
        Assert.Equal("fixture-secret", added.Password);
        Assert.Empty(added.Protocols);
        Assert.Empty(added.Capabilities);
        Assert.Null(added.VendorFamily);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldSuffixTheSlug_WhenTheSlugIsTaken()
    {
        // Arrange
        _repo.GetBySlugAsync("garage", Arg.Any<CancellationToken>()).Returns(new Camera { Slug = "garage", DisplayName = "Garage", Host = "192.168.1.2", FrigateCameraName = "garage" });
        _repo.GetBySlugAsync("garage-2", Arg.Any<CancellationToken>()).Returns((Camera?)null);

        // Act
        var result = await _sut.ExecuteAsync(new CreateCameraRequest("Garage", "192.168.1.20", null, null));

        // Assert
        Assert.Equal("garage-2", result.Slug);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldRefuseWithoutAddingTheCamera_WhenTheAddressIsMissing()
    {
        // Arrange
        var request = new CreateCameraRequest("Porch", " ", null, null);

        // Act
        var thrown = await Record.ExceptionAsync(() => _sut.ExecuteAsync(request));

        // Assert
        Assert.IsAssignableFrom<ArgumentException>(thrown);
        await _repo.DidNotReceive().AddAsync(Arg.Any<Camera>(), Arg.Any<CancellationToken>());
    }
}

public class VerifyCameraUseCaseTests
{
    private readonly ICameraRepository _repo = Substitute.For<ICameraRepository>();
    private readonly ICameraCapabilityBindingRepository _bindings = Substitute.For<ICameraCapabilityBindingRepository>();
    private readonly ICameraVerifier _verifier = Substitute.For<ICameraVerifier>();
    private readonly ICameraStreamEnumerator _streamEnumerator = Substitute.For<ICameraStreamEnumerator>();
    private readonly ICameraProtocolProbe _protocols = CapabilityTestUseCases.AnsweringProbe();
    private readonly IFrigateConfigApplier _applier = Substitute.For<IFrigateConfigApplier>();
    private readonly VerifyCameraUseCase _sut;

    public VerifyCameraUseCaseTests()
    {
        _streamEnumerator.EnumerateAsync(Arg.Any<Camera>(), Arg.Any<SupportedProtocol>(), Arg.Any<CancellationToken>())
            .Returns([]);
        _sut = new VerifyCameraUseCase(_repo, _bindings, _verifier, _streamEnumerator, new CameraProtocolCheck(_protocols, TimeProvider.System), _applier, TimeProvider.System);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldSaveTheStatusTheVerifierReports_WhenTheCameraIsVerified()
    {
        var camera = new Camera
        {
            Id = "camera-1",
            Slug = "front-door",
            FrigateCameraName = "front_door",
            DisplayName = "Front Door",
            Host = "192.168.1.10",
        };

        _repo.GetByIdAsync(camera.Id, Arg.Any<CancellationToken>()).Returns(camera);
        _verifier.VerifyAsync(camera, Arg.Any<CameraStream?>(), Arg.Any<CancellationToken>()).Returns(
            new CameraVerificationResult(true, true, "online", "Verified.", DateTimeOffset.Parse("2026-05-12T10:00:00+00:00", CultureInfo.InvariantCulture), DateTimeOffset.Parse("2026-05-12T10:00:00+00:00", CultureInfo.InvariantCulture)));

        var result = await _sut.ExecuteAsync(camera.Id);

        Assert.NotNull(result);
        Assert.Equal("online", result!.Status);
        await _repo.Received(1).UpdateAsync(Arg.Is<Camera>(updated => updated.Status == "online"), Arg.Any<CancellationToken>());
    }

    // ── Stream enumeration on verification (ADR-38) ──

    private Camera GivenReachableCamera(string? path = "/stream1")
    {
        var camera = new Camera
        {
            Id = "camera-1",
            Slug = "front-door",
            FrigateCameraName = "front_door",
            DisplayName = "Front Door",
            Host = "192.168.1.10",
        }.WithStream(SupportedProtocol.Rtsp, path: path);
        _repo.GetByIdAsync(camera.Id, Arg.Any<CancellationToken>()).Returns(camera);
        _bindings.GetAsync(camera.Id, CameraCapability.Stream, Arg.Any<CancellationToken>()).Returns(camera.StreamBinding);
        _verifier.VerifyAsync(camera, Arg.Any<CameraStream?>(), Arg.Any<CancellationToken>()).Returns(
            new CameraVerificationResult(true, true, "online", "Verified.", DateTimeOffset.UtcNow, DateTimeOffset.UtcNow));
        return camera;
    }

    private void GivenEnumeratedStreams(params EnumeratedStream[] streams)
        => _streamEnumerator.EnumerateAsync(Arg.Any<Camera>(), Arg.Any<SupportedProtocol>(), Arg.Any<CancellationToken>())
            .Returns([new EnumeratedScene("source0", streams)]);

    [Fact]
    public async Task ExecuteAsync_ShouldRecordTheStreamsTheCameraReports_WhenTheCameraIsReachable()
    {
        var camera = GivenReachableCamera();
        GivenEnumeratedStreams(
            new EnumeratedStream("/stream1", 2304, 1296, 12),
            new EnumeratedStream("/stream2", 640, 360, 12));

        await _sut.ExecuteAsync(camera.Id);

        Assert.Equal(2, camera.Streams.Count);
        var sub = camera.Streams.Single(stream => stream.Ordinal == 1);
        Assert.Equal("/stream2", sub.Path);
        Assert.Equal(640, sub.Width);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldRefreshAStreamSize_WhenTheCameraReportsItsAddress()
    {
        // Arrange
        var camera = GivenReachableCamera("/stream1");
        GivenEnumeratedStreams(new EnumeratedStream("stream1", 640, 480, 12));

        // Act
        await _sut.ExecuteAsync(camera.Id);

        // Assert
        var stream = Assert.Single(camera.Streams);
        Assert.Equal("/stream1", stream.Path);
        Assert.Equal(640, stream.Width);
        Assert.Equal(480, stream.Height);
    }

    // A vendor alias: the camera answers on /stream1 but advertises a different address at 1080p.
    // Adopting that size would make Frigate upscale a stream that is not 1080p.
    [Fact]
    public async Task ExecuteAsync_ShouldRefuseTheAdvertisedSize_WhenItBelongsToADifferentAddress()
    {
        // Arrange
        var camera = GivenReachableCamera("/stream1");
        GivenEnumeratedStreams(
            new EnumeratedStream("/live/ch00_1", 1920, 1080, 20),
            new EnumeratedStream("/live/ch00_0", 640, 480, 25));

        // Act
        await _sut.ExecuteAsync(camera.Id);

        // Assert
        var typed = camera.Streams.Single(stream => stream.Path == "/stream1");
        Assert.Null(typed.Width);
        Assert.Null(typed.Height);
        Assert.Equal(1920, camera.Streams.Single(stream => stream.Path == "/live/ch00_1").Width);
        Assert.Equal(640, camera.Streams.Single(stream => stream.Path == "/live/ch00_0").Width);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldRecordOnTheMainAndDetectOnTheLightest_WhenTheStreamsAreFoundFirst()
    {
        // Arrange
        var camera = GivenReachableCamera();
        GivenEnumeratedStreams(
            new EnumeratedStream("/stream1", 2304, 1296, 12),
            new EnumeratedStream("/stream2", 640, 360, 12));

        // Act
        await _sut.ExecuteAsync(camera.Id);

        // Assert
        Assert.Equal(StreamRole.Record, camera.Streams.First().Role);
        Assert.Equal("/stream2", camera.DetectStream!.Path);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldKeepAStreamTheCameraNoLongerReports_WhenTheStreamsWereAlreadyFound()
    {
        // Arrange
        var camera = GivenReachableCamera();
        GivenEnumeratedStreams(new EnumeratedStream("/stream1", 1920, 1080, 12), new EnumeratedStream("/stream2", 640, 360, 12));
        await _sut.ExecuteAsync(camera.Id);
        GivenEnumeratedStreams(new EnumeratedStream("/stream1", 1920, 1080, 12));

        // Act
        await _sut.ExecuteAsync(camera.Id);

        // Assert
        Assert.Contains(camera.Streams, stream => stream.Path == "/stream2");
    }

    [Fact]
    public async Task ExecuteAsync_ShouldNotBringBackARemovedStream_WhenTheStreamsWereAlreadyFound()
    {
        // Arrange
        var camera = GivenReachableCamera();
        GivenEnumeratedStreams(new EnumeratedStream("/stream1", 1920, 1080, 12), new EnumeratedStream("/stream2", 640, 360, 12));
        await _sut.ExecuteAsync(camera.Id);
        StreamLineup.Remove(camera.StreamBinding!, camera.Streams.Single(stream => stream.Path == "/stream2"));

        // Act
        await _sut.ExecuteAsync(camera.Id);

        // Assert
        Assert.Single(camera.Streams);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldCheckEveryStream_WhenTheCameraIsVerified()
    {
        // Arrange
        var camera = GivenReachableCamera();
        var sub = StreamLineup.Add(camera.StreamBinding!, SupportedProtocol.Rtsp, "/stream2", StreamRole.Detect);
        _verifier.VerifyAsync(camera, sub, Arg.Any<CancellationToken>()).Returns(
            new CameraVerificationResult(true, false, "degraded", "No answer on this path.", DateTimeOffset.UtcNow, null));

        // Act
        await _sut.ExecuteAsync(camera.Id);

        // Assert
        Assert.True(camera.Streams.First().Verified);
        Assert.False(sub.Verified);
        Assert.Equal("No answer on this path.", sub.LastError);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldCheckAStreamWithNoRole_WhenTheCameraIsVerified()
    {
        // Arrange
        var camera = GivenReachableCamera();
        var sub = StreamLineup.Add(camera.StreamBinding!, SupportedProtocol.Rtsp, "/stream2", StreamRole.None);

        // Act
        await _sut.ExecuteAsync(camera.Id);

        // Assert
        Assert.NotNull(sub.CheckedAt);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldMarkTheStreamVerifiedAndItsProtocolAnswering_WhenTheVerificationSucceeds()
    {
        // Arrange
        var camera = GivenReachableCamera();

        // Act
        await _sut.ExecuteAsync(camera.Id);

        // Assert
        Assert.True(camera.StreamBinding!.Verified);
        Assert.Equal(ProtocolStatus.Answers, camera.Protocol(SupportedProtocol.Rtsp)!.Status);
        await _bindings.Received(1).SaveAsync(camera.StreamBinding, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldNotVerifyTheStream_WhenItsProtocolRefusesTheAccount()
    {
        // Arrange
        var camera = GivenReachableCamera();
        _protocols.ProbeAsync(camera, SupportedProtocol.Rtsp, Arg.Any<CancellationToken>())
            .Returns(ProtocolAnswer.Refused("RTSP: 192.168.1.10:554 refused the account (401 Unauthorized)."));

        // Act
        var result = await _sut.ExecuteAsync(camera.Id);

        // Assert
        Assert.Equal("needs_attention", result!.Status);
        Assert.Equal("RTSP: 192.168.1.10:554 refused the account (401 Unauthorized).", camera.StreamBinding!.LastError);
        await _verifier.DidNotReceive().VerifyAsync(Arg.Any<Camera>(), Arg.Any<CameraStream?>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldKeepTheVerifierReasonOnTheStream_WhenTheCameraIsUnreachable()
    {
        // Arrange
        var camera = GivenReachableCamera();
        _verifier.VerifyAsync(camera, Arg.Any<CameraStream?>(), Arg.Any<CancellationToken>()).Returns(
            new CameraVerificationResult(false, false, "offline", "Unreachable.", DateTimeOffset.UtcNow, null));

        // Act
        await _sut.ExecuteAsync(camera.Id);

        // Assert
        Assert.False(camera.StreamBinding!.Verified);
        Assert.Equal("Unreachable.", camera.StreamBinding.LastError);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldKeepTheStreamsItAlreadyHad_WhenTheCameraIsUnreachable()
    {
        var camera = GivenReachableCamera();
        _verifier.VerifyAsync(camera, Arg.Any<CameraStream?>(), Arg.Any<CancellationToken>()).Returns(
            new CameraVerificationResult(false, false, "offline", "Unreachable.", DateTimeOffset.UtcNow, null));

        await _sut.ExecuteAsync(camera.Id);

        Assert.Equal("/stream1", camera.Streams.FirstOrDefault()?.Path);
        await _streamEnumerator.DidNotReceive().EnumerateAsync(Arg.Any<Camera>(), Arg.Any<SupportedProtocol>(), Arg.Any<CancellationToken>());
    }

    // ── A camera to set up (ADR-68 d) ──

    [Fact]
    public async Task ExecuteAsync_ShouldLeaveToSetUpAndSummonTheRestart_WhenTheStreamWorksForTheFirstTime()
    {
        // Arrange
        var camera = GivenReachableCamera();
        camera.ValidationState = CameraValidationState.ToSetUp;
        _repo.GetAllAsync(Arg.Any<CancellationToken>()).Returns([camera]);

        // Act
        var result = await _sut.ExecuteAsync(camera.Id);

        // Assert
        Assert.Equal(CameraValidationState.Draft, camera.ValidationState);
        Assert.Equal("online", result!.Status);
        await _applier.Received(1).WriteConfigAsync(Arg.Any<IReadOnlyList<Camera>>(), changed: true, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldStayToSetUpWithoutSummoningTheRestart_WhenTheStreamFails()
    {
        // Arrange
        var camera = GivenReachableCamera();
        camera.ValidationState = CameraValidationState.ToSetUp;
        _verifier.VerifyAsync(camera, Arg.Any<CameraStream?>(), Arg.Any<CancellationToken>()).Returns(
            new CameraVerificationResult(false, false, "offline", "Unreachable.", DateTimeOffset.UtcNow, null));

        // Act
        var result = await _sut.ExecuteAsync(camera.Id);

        // Assert
        Assert.Equal(CameraValidationState.ToSetUp, camera.ValidationState);
        Assert.Equal("to_set_up", result!.Status);
        await _applier.DidNotReceive().WriteConfigAsync(Arg.Any<IReadOnlyList<Camera>>(), Arg.Any<bool>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldReadOffline_WhenTheStreamFailsAfterItWorkedOnce()
    {
        // Arrange
        var camera = GivenReachableCamera();
        camera.ValidationState = CameraValidationState.Validated;
        _verifier.VerifyAsync(camera, Arg.Any<CameraStream?>(), Arg.Any<CancellationToken>()).Returns(
            new CameraVerificationResult(false, false, "offline", "Unreachable.", DateTimeOffset.UtcNow, null));

        // Act
        var result = await _sut.ExecuteAsync(camera.Id);

        // Assert
        Assert.Equal("offline", result!.Status);
        Assert.Equal(CameraValidationState.Validated, camera.ValidationState);
    }
}

public class ApplyCameraUseCaseTests
{
    private readonly ICameraRepository _repo = Substitute.For<ICameraRepository>();
    private readonly IFrigateConfigApplier _applier = Substitute.For<IFrigateConfigApplier>();
    private readonly ApplyCameraUseCase _sut;

    public ApplyCameraUseCaseTests() => _sut = new ApplyCameraUseCase(_repo, _applier);

    [Fact]
    public async Task ExecuteAsync_ShouldRefuseToApply_WhenTheCameraIsNotVerifiedOnline()
    {
        var camera = new Camera
        {
            Id = "camera-1",
            Slug = "front-door",
            FrigateCameraName = "front_door",
            DisplayName = "Front Door",
            Host = "192.168.1.10",
            Status = "offline",
            ValidationState = CameraValidationState.Draft,
        };

        _repo.GetByIdAsync(camera.Id, Arg.Any<CancellationToken>()).Returns(camera);

        var result = await _sut.ExecuteAsync(camera.Id);

        Assert.NotNull(result);
        Assert.False(result!.Applied);
        await _applier.DidNotReceive().ApplyAsync(Arg.Any<IReadOnlyList<Camera>>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldMarkTheCameraValidatedAndEnabled_WhenTheApplySucceeds()
    {
        var camera = new Camera
        {
            Id = "camera-1",
            Slug = "front-door",
            FrigateCameraName = "front_door",
            DisplayName = "Front Door",
            Host = "192.168.1.10",
            Status = "online",
            ValidationState = CameraValidationState.Draft,
        };

        _repo.GetByIdAsync(camera.Id, Arg.Any<CancellationToken>()).Returns(camera);
        _repo.GetAllAsync(Arg.Any<CancellationToken>()).Returns([camera]);
        _applier.ApplyAsync(Arg.Any<IReadOnlyList<Camera>>(), Arg.Any<CancellationToken>()).Returns(new FrigateConfigApplyResult(true, "Applied.", "config/frigate.generated.yml"));

        var result = await _sut.ExecuteAsync(camera.Id);

        Assert.NotNull(result);
        Assert.True(result!.Applied);
        await _repo.Received(1).UpdateAsync(Arg.Is<Camera>(updated => updated.ValidationState == CameraValidationState.Validated && updated.IsEnabled), Arg.Any<CancellationToken>());
    }
}

public class DeleteCameraUseCaseTests
{
    private readonly ICameraRepository _repo = Substitute.For<ICameraRepository>();
    private readonly IFrigateConfigApplier _applier = Substitute.For<IFrigateConfigApplier>();
    private readonly DeleteCameraUseCase _sut;

    public DeleteCameraUseCaseTests()
    {
        _repo.GetAllAsync(Arg.Any<CancellationToken>()).Returns(new List<Camera>());
        _sut = new DeleteCameraUseCase(_repo, _applier);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldMarkTheCameraPendingRemovalAndDisableIt_WhenAValidatedCameraIsDeleted()
    {
        var camera = new Camera
        {
            Id = "camera-1",
            Slug = "front-door",
            FrigateCameraName = "front_door",
            DisplayName = "Front Door",
            Host = "192.168.1.10",
            ValidationState = CameraValidationState.Validated,
            IsEnabled = true,
        };

        _repo.GetByIdAsync(camera.Id, Arg.Any<CancellationToken>()).Returns(camera);

        var result = await _sut.ExecuteAsync(camera.Id);

        Assert.NotNull(result);
        Assert.True(result!.Deleted);
        await _repo.Received(1).UpdateAsync(Arg.Is<Camera>(updated =>
            updated.ValidationState == CameraValidationState.PendingRemoval
            && updated.IsEnabled == false), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldRemoveTheCameraAtOnceWithoutSummoningTheRestart_WhenTheCameraIsToSetUp()
    {
        // Arrange
        var camera = new Camera
        {
            Id = "camera-1",
            Slug = "front-door",
            FrigateCameraName = "front_door",
            DisplayName = "Front Door",
            Host = "192.168.1.10",
            ValidationState = CameraValidationState.ToSetUp,
        };
        _repo.GetByIdAsync(camera.Id, Arg.Any<CancellationToken>()).Returns(camera);

        // Act
        var result = await _sut.ExecuteAsync(camera.Id);

        // Assert
        Assert.True(result!.Deleted);
        await _repo.Received(1).DeleteAsync(camera, Arg.Any<CancellationToken>());
        await _applier.DidNotReceive().WriteConfigAsync(Arg.Any<IReadOnlyList<Camera>>(), Arg.Any<bool>(), Arg.Any<CancellationToken>());
    }
}

public class UpdateCameraUseCaseTests
{
    private readonly ICameraRepository _repo = Substitute.For<ICameraRepository>();
    private readonly IFrigateConfigApplier _applier = Substitute.For<IFrigateConfigApplier>();
    private readonly UpdateCameraUseCase _sut;

    public UpdateCameraUseCaseTests()
    {
        _repo.GetAllAsync(Arg.Any<CancellationToken>()).Returns(new List<Camera>());
        _sut = new UpdateCameraUseCase(_repo, _applier);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldKeepTheCameraValidated_WhenOnlyTheDisplayNameChanges()
    {
        var camera = new Camera
        {
            Id = "camera-1",
            Slug = "front-door",
            FrigateCameraName = "front_door",
            DisplayName = "Front Door",
            Host = "192.168.1.10",
            Status = "online",
            ValidationState = CameraValidationState.Validated,
            IsEnabled = true,
            SourceType = "rtsp_manual",
        };

        _repo.GetByIdAsync(camera.Id, Arg.Any<CancellationToken>()).Returns(camera);

        var result = await _sut.ExecuteAsync(camera.Id, new UpdateCameraRequest(
            "Entry",
            "192.168.1.10",
            null,
            null,
            "rtsp_manual"));

        Assert.NotNull(result);
        Assert.Equal("Entry", result!.DisplayName);
        await _repo.Received(1).UpdateAsync(Arg.Is<Camera>(updated =>
            updated.DisplayName == "Entry"
            && updated.ValidationState == CameraValidationState.Validated
            && updated.IsEnabled), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldResetTheCameraToDraft_WhenItsAddressChanges()
    {
        // Arrange
        var camera = new Camera
        {
            Id = "camera-1",
            Slug = "front-door",
            FrigateCameraName = "front_door",
            DisplayName = "Front Door",
            Host = "192.168.1.10",
            Status = "online",
            ValidationState = CameraValidationState.Validated,
            IsEnabled = true,
            SourceType = "rtsp_manual",
        };
        _repo.GetByIdAsync(camera.Id, Arg.Any<CancellationToken>()).Returns(camera);

        // Act
        var result = await _sut.ExecuteAsync(camera.Id, new UpdateCameraRequest(
            "Front Door",
            "192.168.1.12",
            null,
            null,
            "rtsp_manual"));

        // Assert
        Assert.NotNull(result);
        await _repo.Received(1).UpdateAsync(Arg.Is<Camera>(updated =>
            updated.Host == "192.168.1.12"
            && updated.ValidationState == CameraValidationState.Draft
            && updated.IsEnabled == false
            && updated.Status == "needs_attention"), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldStayToSetUpWithoutSummoningTheRestart_WhenTheAddressOfACameraToSetUpChanges()
    {
        // Arrange
        var camera = new Camera
        {
            Id = "camera-1",
            Slug = "front-door",
            FrigateCameraName = "front_door",
            DisplayName = "Front Door",
            Host = "192.168.1.10",
            ValidationState = CameraValidationState.ToSetUp,
        };
        _repo.GetByIdAsync(camera.Id, Arg.Any<CancellationToken>()).Returns(camera);

        // Act
        var result = await _sut.ExecuteAsync(camera.Id, new UpdateCameraRequest("Front Door", "192.168.1.12", null, null, null));

        // Assert
        Assert.Equal("to_set_up", result!.Status);
        Assert.Equal(CameraValidationState.ToSetUp, camera.ValidationState);
        await _applier.Received(1).WriteConfigAsync(Arg.Any<IReadOnlyList<Camera>>(), changed: false, Arg.Any<CancellationToken>());
    }
}

public class ApplyCameraConfigurationUseCaseTests
{
    private readonly ICameraRepository _repo = Substitute.For<ICameraRepository>();
    private readonly IFrigateConfigApplier _applier = Substitute.For<IFrigateConfigApplier>();
    private readonly ApplyCameraConfigurationUseCase _sut;

    public ApplyCameraConfigurationUseCaseTests() => _sut = new ApplyCameraConfigurationUseCase(_repo, _applier);

    [Fact]
    public async Task ExecuteAsync_ShouldApplyAndValidateEveryCamera_WhenEachIsOnlineOrAlreadyValidated()
    {
        var onlineDraft = new Camera
        {
            Id = "camera-1",
            Slug = "front-door",
            FrigateCameraName = "front_door",
            DisplayName = "Front Door",
            Host = "192.168.1.10",
            Status = "online",
            ValidationState = CameraValidationState.Draft,
        };

        var validated = new Camera
        {
            Id = "camera-2",
            Slug = "garage",
            FrigateCameraName = "garage",
            DisplayName = "Garage",
            Host = "192.168.1.11",
            Status = "offline",
            ValidationState = CameraValidationState.Validated,
            IsEnabled = true,
        };

        _repo.GetAllAsync(Arg.Any<CancellationToken>()).Returns([onlineDraft, validated]);
        _applier.ApplyAsync(Arg.Any<IReadOnlyList<Camera>>(), Arg.Any<CancellationToken>())
            .Returns(new FrigateConfigApplyResult(true, "Applied.", "config/frigate.generated.yml"));

        var result = await _sut.ExecuteAsync();

        Assert.True(result.Applied);
        Assert.Equal(2, result.CameraCount);
        await _repo.Received(2).UpdateAsync(Arg.Is<Camera>(camera => camera.ValidationState == CameraValidationState.Validated && camera.IsEnabled), Arg.Any<CancellationToken>());
    }
}
