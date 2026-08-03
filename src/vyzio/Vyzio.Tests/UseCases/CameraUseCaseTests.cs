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
    public async Task Execute_returns_camera_dtos_with_status_projection()
    {
        _repo.GetAllAsync(Arg.Any<CancellationToken>()).Returns(
        [
            new Camera
            {
                Slug = "front-door",
                DisplayName = "Front Door",
                Host = "192.168.1.10",
                Port = 554,
                Status = "online",
                ValidationState = "validated",
                IsEnabled = true,
                LastSuccessfulFrameAt = DateTimeOffset.Parse("2026-05-12T09:00:00+00:00")
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
    public async Task Execute_includes_verified_capabilities_from_bindings()
    {
        var cameraId = "cam-1";
        _repo.GetAllAsync(Arg.Any<CancellationToken>()).Returns(
        [
            new Camera { Id = cameraId, Slug = "garage", DisplayName = "Garage", Host = "192.168.1.11", Port = 554, Status = "online", ValidationState = "validated", IsEnabled = true }
        ]);
        _bindings.GetAllVerifiedAsync(Arg.Any<CancellationToken>()).Returns(
        [
            new CameraCapabilityBinding { CameraId = cameraId, Capability = CameraCapability.Ptz, Protocol = SupportedProtocol.Onvif, Verified = true }
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
    public async Task Execute_returns_guidance_for_draft_camera()
    {
        var camera = new Camera
        {
            Id = "camera-1",
            Slug = "garage",
            DisplayName = "Garage",
            Host = "192.168.1.11",
            Port = 554,
            ValidationState = "draft",
            Status = "needs_attention"
        };

        _repo.GetByIdAsync(camera.Id, Arg.Any<CancellationToken>()).Returns(camera);

        var result = await _sut.ExecuteAsync(camera.Id);

        Assert.NotNull(result);
        Assert.True(result!.NeedsAttention);
        Assert.Equal("Configuration incomplete. Ajoutez le chemin RTSP, puis lancez la verification.", result.Guidance);
    }

    [Fact]
    public async Task Execute_returns_null_when_camera_not_found()
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
    public async Task Execute_returns_discovered_candidates()
    {
        _repo.GetAllAsync(Arg.Any<CancellationToken>()).Returns([]);
        _discovery.DiscoverAsync(null, Arg.Any<CancellationToken>()).Returns(
        [
            new CameraDiscoveryCandidate("Driveway", "192.168.1.20", 554, "onvif", null, "onvif", "ONVIF device announced.", "AA:BB:CC:DD:EE:FF", "camera_confirmed", "unknown", null, ["onvif_detected", "mac_address_observed"])
        ]);

        var result = await _sut.ExecuteAsync();

        var candidate = Assert.Single(result);
        Assert.Equal("Driveway", candidate.DisplayName);
        Assert.Equal("192.168.1.20", candidate.Host);
        Assert.Equal("AA:BB:CC:DD:EE:FF", candidate.MacAddress);
        Assert.Equal("camera_confirmed", candidate.Qualification);
        Assert.Contains("onvif_detected", candidate.QualificationReasons);
    }

    [Fact]
    public async Task Execute_filters_out_already_configured_candidates()
    {
        _repo.GetAllAsync(Arg.Any<CancellationToken>()).Returns(
        [
            new Camera
            {
                Id = "camera-1",
                Slug = "front-door",
                DisplayName = "Front Door",
                Host = "192.168.1.10",
                Port = 554,
            }
        ]);

        _discovery.DiscoverAsync(null, Arg.Any<CancellationToken>()).Returns(
        [
            new CameraDiscoveryCandidate("Front Door", "192.168.1.10", 554, "onvif", null, "onvif", null, null, "camera_confirmed", "unknown", null, []),
            new CameraDiscoveryCandidate("Driveway", "192.168.1.20", 554, "onvif", null, "onvif", null, null, "camera_confirmed", "unknown", null, [])
        ]);

        var result = await _sut.ExecuteAsync();

        var candidate = Assert.Single(result);
        Assert.Equal("Driveway", candidate.DisplayName);
    }

    [Fact]
    public async Task Execute_refreshes_targeted_candidate_without_filtering_configured_endpoint()
    {
        _repo.GetAllAsync(Arg.Any<CancellationToken>()).Returns(
        [
            new Camera
            {
                Id = "camera-1",
                Slug = "front-door",
                DisplayName = "Front Door",
                Host = "192.168.1.10",
                Port = 554,
            }
        ]);

        _discovery.DiscoverAsync(Arg.Any<CameraDiscoveryTarget>(), Arg.Any<CancellationToken>()).Returns(
        [
            new CameraDiscoveryCandidate("Front Door", "192.168.1.10", 554, "onvif", "/Streaming/Channels/101", "rtsp_describe", null, null, "camera_confirmed", "unknown", null, ["rtsp_responding"])
        ]);

        var result = await _sut.ExecuteAsync(new DiscoverCamerasRequest("192.168.1.10", 554));

        var candidate = Assert.Single(result);
        Assert.Equal("Front Door", candidate.DisplayName);
        Assert.True(candidate.RtspActive);
        await _discovery.Received(1).DiscoverAsync(
            Arg.Is<CameraDiscoveryTarget>(target => target.Host == "192.168.1.10" && target.Port == 554),
            Arg.Any<CancellationToken>());
    }
}

public class GetVendorAssistanceUseCaseTests
{
    private readonly IVendorAssistanceService _vendorAssistance = Substitute.For<IVendorAssistanceService>();
    private readonly GetVendorAssistanceUseCase _sut;

    public GetVendorAssistanceUseCaseTests() => _sut = new GetVendorAssistanceUseCase(_vendorAssistance);

    [Fact]
    public async Task Execute_returns_markdown_when_vendor_requires_rtsp_assistance()
    {
        _vendorAssistance.GetAssistanceAsync("v380_pro", null, false, Arg.Any<CancellationToken>())
            .Returns(new VendorDocumentation("v380_pro", "# V380 PRO\n\nNotice RTSP de test."));

        var result = await _sut.ExecuteAsync(new VendorAssistanceRequestDto("v380_pro", null, false));

        Assert.NotNull(result);
        Assert.Equal("v380_pro", result!.VendorFamily);
        Assert.Contains("# V380 PRO", result.Markdown);
    }
}

public class CreateCameraUseCaseTests
{
    private readonly ICameraRepository _repo = Substitute.For<ICameraRepository>();
    private readonly ICameraCapabilityOnboardingQueue _queue = Substitute.For<ICameraCapabilityOnboardingQueue>();
    private readonly IFrigateConfigApplier _configApplier = Substitute.For<IFrigateConfigApplier>();
    private readonly CreateCameraUseCase _sut;

    public CreateCameraUseCaseTests() => _sut = new CreateCameraUseCase(_repo, _queue, _configApplier);

    [Fact]
    public async Task Execute_creates_draft_camera_with_slug_and_defaults()
    {
        _repo.GetBySlugAsync("front-door", Arg.Any<CancellationToken>()).Returns((Camera?)null);

        var result = await _sut.ExecuteAsync(new CreateCameraRequest("Front Door", "192.168.1.10", 554, null, null, "/rtsp", null, "tplink_tapo"));

        Assert.Equal("front-door", result.Slug);
        Assert.Equal("needs_attention", result.Status);
        await _repo.Received(1).AddAsync(Arg.Is<Camera>(camera =>
            camera.DisplayName == "Front Door"
            && camera.VendorFamily == VendorFamily.TplinkTapo
            && camera.ValidationState == "draft"
            && camera.IsEnabled == false), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Execute_enqueues_capability_probe_after_creation()
    {
        _repo.GetBySlugAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns((Camera?)null);

        await _sut.ExecuteAsync(new CreateCameraRequest("Garage", "192.168.1.20", 554, null, null, null, null, "icsee"));

        _queue.Received(1).Enqueue(Arg.Any<string>());
    }

    [Fact]
    public async Task Execute_marks_the_configuration_as_waiting_for_a_restart()
    {
        _repo.GetBySlugAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns((Camera?)null);
        _repo.GetAllAsync(Arg.Any<CancellationToken>()).Returns([]);

        await _sut.ExecuteAsync(new CreateCameraRequest("Garage", "192.168.1.20", 554, null, null, null, null, null));

        // Otherwise the trigger stays hidden, and its absence says everything is in service (ADR-44).
        await _configApplier.Received(1).WriteConfigAsync(
            Arg.Any<IReadOnlyList<Camera>>(), changed: true, Arg.Any<CancellationToken>());
    }
}

public class VerifyCameraUseCaseTests
{
    private readonly ICameraRepository _repo = Substitute.For<ICameraRepository>();
    private readonly ICameraVerifier _verifier = Substitute.For<ICameraVerifier>();
    private readonly ICameraStreamEnumerator _streamEnumerator = Substitute.For<ICameraStreamEnumerator>();
    private readonly VerifyCameraUseCase _sut;

    public VerifyCameraUseCaseTests()
    {
        _streamEnumerator.EnumerateAsync(Arg.Any<Camera>(), Arg.Any<CancellationToken>())
            .Returns([]);
        _sut = new VerifyCameraUseCase(_repo, _verifier, _streamEnumerator);
    }

    [Fact]
    public async Task Execute_updates_camera_status_from_verifier_result()
    {
        var camera = new Camera
        {
            Id = "camera-1",
            Slug = "front-door",
            DisplayName = "Front Door",
            Host = "192.168.1.10",
            Port = 554,
        };

        _repo.GetByIdAsync(camera.Id, Arg.Any<CancellationToken>()).Returns(camera);
        _verifier.VerifyAsync(camera, Arg.Any<CancellationToken>()).Returns(
            new CameraVerificationResult(true, true, "online", "Verified.", DateTimeOffset.Parse("2026-05-12T10:00:00+00:00"), DateTimeOffset.Parse("2026-05-12T10:00:00+00:00")));

        var result = await _sut.ExecuteAsync(camera.Id);

        Assert.NotNull(result);
        Assert.Equal("online", result!.Status);
        await _repo.Received(1).UpdateAsync(Arg.Is<Camera>(updated => updated.Status == "online"), Arg.Any<CancellationToken>());
    }

    // ── Stream enumeration on verification (ADR-38) ──

    private Camera GivenReachableCamera(string? mainPath = "/stream1")
    {
        var camera = new Camera
        {
            Id = "camera-1",
            Slug = "front-door",
            DisplayName = "Front Door",
            Host = "192.168.1.10",
            Port = 554,
            StreamPath = mainPath,
        };
        _repo.GetByIdAsync(camera.Id, Arg.Any<CancellationToken>()).Returns(camera);
        _verifier.VerifyAsync(camera, Arg.Any<CancellationToken>()).Returns(
            new CameraVerificationResult(true, true, "online", "Verified.", DateTimeOffset.UtcNow, DateTimeOffset.UtcNow));
        return camera;
    }

    private void GivenEnumeratedStreams(params EnumeratedStream[] streams)
        => _streamEnumerator.EnumerateAsync(Arg.Any<Camera>(), Arg.Any<CancellationToken>())
            .Returns([new EnumeratedScene("source0", streams)]);

    [Fact]
    public async Task Verification_records_the_streams_the_camera_reports()
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
    public async Task Verification_refreshes_the_main_stream_size_when_both_addresses_agree()
    {
        var camera = GivenReachableCamera("/stream1");
        GivenEnumeratedStreams(new EnumeratedStream("stream1", 640, 480, 12));

        await _sut.ExecuteAsync(camera.Id);

        var main = camera.MainStream!;
        Assert.Equal("/stream1", main.Path);
        Assert.Equal(640, main.Width);
        Assert.Equal(480, main.Height);
    }

    // A vendor alias: the camera answers on /stream1 but advertises a different address at 1080p.
    // Adopting that size would make Frigate upscale a stream that is not 1080p.
    [Fact]
    public async Task An_advertised_size_is_refused_when_it_belongs_to_a_different_address()
    {
        var camera = GivenReachableCamera("/stream1");
        GivenEnumeratedStreams(
            new EnumeratedStream("/live/ch00_1", 1920, 1080, 20),
            new EnumeratedStream("/live/ch00_0", 640, 480, 25));

        await _sut.ExecuteAsync(camera.Id);

        var main = camera.MainStream!;
        Assert.Equal("/stream1", main.Path);
        Assert.Null(main.Width);
        Assert.Null(main.Height);

        // The sub-stream is a coherent address/size pair, so it keeps both.
        var sub = camera.Streams.Single(stream => stream.Ordinal == 1);
        Assert.Equal("/live/ch00_0", sub.Path);
        Assert.Equal(640, sub.Width);
    }

    [Fact]
    public async Task A_sub_stream_that_disappeared_is_dropped_along_with_a_choice_pointing_at_it()
    {
        var camera = GivenReachableCamera();
        var sub = new CameraStream { CameraId = camera.Id, Ordinal = 1, Path = "/stream2" };
        camera.Streams.Add(sub);
        camera.DetectStreamId = sub.Id;

        GivenEnumeratedStreams(new EnumeratedStream("/stream1", 1920, 1080, 12));

        await _sut.ExecuteAsync(camera.Id);

        Assert.DoesNotContain(camera.Streams, stream => stream.Ordinal == 1);
        Assert.Null(camera.DetectStreamId);
    }

    [Fact]
    public async Task A_successful_verification_records_the_transport_as_a_proven_protocol()
    {
        var camera = GivenReachableCamera();

        await _sut.ExecuteAsync(camera.Id);

        Assert.Contains(SupportedProtocol.Rtsp, camera.GetSupportedProtocols());
    }

    [Fact]
    public async Task An_unreachable_camera_proves_nothing()
    {
        var camera = GivenReachableCamera();
        _verifier.VerifyAsync(camera, Arg.Any<CancellationToken>()).Returns(
            new CameraVerificationResult(false, false, "offline", "Unreachable.", DateTimeOffset.UtcNow, null));

        await _sut.ExecuteAsync(camera.Id);

        Assert.Empty(camera.GetSupportedProtocols());
    }

    [Fact]
    public async Task An_unreachable_camera_keeps_the_streams_it_already_had()
    {
        var camera = GivenReachableCamera();
        _verifier.VerifyAsync(camera, Arg.Any<CancellationToken>()).Returns(
            new CameraVerificationResult(false, false, "offline", "Unreachable.", DateTimeOffset.UtcNow, null));

        await _sut.ExecuteAsync(camera.Id);

        Assert.Equal("/stream1", camera.StreamPath);
        await _streamEnumerator.DidNotReceive().EnumerateAsync(Arg.Any<Camera>(), Arg.Any<CancellationToken>());
    }
}

public class VerifyDraftCameraUseCaseTests
{
    private readonly ICameraVerifier _verifier = Substitute.For<ICameraVerifier>();
    private readonly VerifyDraftCameraUseCase _sut;

    public VerifyDraftCameraUseCaseTests() => _sut = new VerifyDraftCameraUseCase(_verifier);

    [Fact]
    public async Task Execute_returns_status_projection_from_transient_camera_verification()
    {
        _verifier.VerifyAsync(Arg.Any<Camera>(), Arg.Any<CancellationToken>()).Returns(
            new CameraVerificationResult(true, true, "online", "Verified.", DateTimeOffset.Parse("2026-05-12T10:00:00+00:00"), DateTimeOffset.Parse("2026-05-12T10:00:00+00:00")));

        var result = await _sut.ExecuteAsync(new CreateCameraRequest(
            "Front Door",
            "192.168.1.10",
            554,
            "admin",
            "secret",
            "Streaming/Channels/101",
            "rtsp_manual",
            "person_default"));

        Assert.Equal("online", result.Status);
        Assert.True(result.Connected);
        await _verifier.Received(1).VerifyAsync(Arg.Is<Camera>(camera =>
            camera.DisplayName == "Front Door"
            && camera.Host == "192.168.1.10"
            && camera.StreamPath == "/Streaming/Channels/101"
            && camera.ValidationState == "draft"), Arg.Any<CancellationToken>());
    }
}

public class ApplyCameraUseCaseTests
{
    private readonly ICameraRepository _repo = Substitute.For<ICameraRepository>();
    private readonly IFrigateConfigApplier _applier = Substitute.For<IFrigateConfigApplier>();
    private readonly ApplyCameraUseCase _sut;

    public ApplyCameraUseCaseTests() => _sut = new ApplyCameraUseCase(_repo, _applier);

    [Fact]
    public async Task Execute_rejects_apply_when_camera_is_not_verified_online()
    {
        var camera = new Camera
        {
            Id = "camera-1",
            Slug = "front-door",
            DisplayName = "Front Door",
            Host = "192.168.1.10",
            Port = 554,
            Status = "offline",
            ValidationState = "draft",
        };

        _repo.GetByIdAsync(camera.Id, Arg.Any<CancellationToken>()).Returns(camera);

        var result = await _sut.ExecuteAsync(camera.Id);

        Assert.NotNull(result);
        Assert.False(result!.Applied);
        await _applier.DidNotReceive().ApplyAsync(Arg.Any<IReadOnlyList<Camera>>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Execute_marks_camera_validated_when_apply_succeeds()
    {
        var camera = new Camera
        {
            Id = "camera-1",
            Slug = "front-door",
            DisplayName = "Front Door",
            Host = "192.168.1.10",
            Port = 554,
            Status = "online",
            ValidationState = "draft",
        };

        _repo.GetByIdAsync(camera.Id, Arg.Any<CancellationToken>()).Returns(camera);
        _repo.GetAllAsync(Arg.Any<CancellationToken>()).Returns([camera]);
        _applier.ApplyAsync(Arg.Any<IReadOnlyList<Camera>>(), Arg.Any<CancellationToken>()).Returns(new FrigateConfigApplyResult(true, "Applied.", "config/frigate.generated.yml"));

        var result = await _sut.ExecuteAsync(camera.Id);

        Assert.NotNull(result);
        Assert.True(result!.Applied);
        await _repo.Received(1).UpdateAsync(Arg.Is<Camera>(updated => updated.ValidationState == "validated" && updated.IsEnabled), Arg.Any<CancellationToken>());
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
    public async Task Execute_marks_camera_pending_removal_without_reapplying()
    {
        var camera = new Camera
        {
            Id = "camera-1",
            Slug = "front-door",
            DisplayName = "Front Door",
            Host = "192.168.1.10",
            ValidationState = "validated",
            IsEnabled = true,
        };

        _repo.GetByIdAsync(camera.Id, Arg.Any<CancellationToken>()).Returns(camera);

        var result = await _sut.ExecuteAsync(camera.Id);

        Assert.NotNull(result);
        Assert.True(result!.Deleted);
        await _repo.Received(1).UpdateAsync(Arg.Is<Camera>(updated =>
            updated.ValidationState == "pending_removal"
            && updated.IsEnabled == false), Arg.Any<CancellationToken>());
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
    public async Task Execute_updates_display_name_without_resetting_verified_state()
    {
        var camera = new Camera
        {
            Id = "camera-1",
            Slug = "front-door",
            DisplayName = "Front Door",
            Host = "192.168.1.10",
            Port = 554,
            StreamPath = "/Streaming/Channels/101",
            Status = "online",
            ValidationState = "validated",
            IsEnabled = true,
            SourceType = "rtsp_manual",
        };

        _repo.GetByIdAsync(camera.Id, Arg.Any<CancellationToken>()).Returns(camera);

        var result = await _sut.ExecuteAsync(camera.Id, new UpdateCameraRequest(
            "Entry",
            "192.168.1.10",
            554,
            null,
            null,
            "/Streaming/Channels/101",
            "rtsp_manual"));

        Assert.NotNull(result);
        Assert.Equal("Entry", result!.DisplayName);
        await _repo.Received(1).UpdateAsync(Arg.Is<Camera>(updated =>
            updated.DisplayName == "Entry"
            && updated.ValidationState == "validated"
            && updated.IsEnabled), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Execute_resets_camera_to_draft_when_stream_settings_change()
    {
        var camera = new Camera
        {
            Id = "camera-1",
            Slug = "front-door",
            DisplayName = "Front Door",
            Host = "192.168.1.10",
            Port = 554,
            StreamPath = "/Streaming/Channels/101",
            Status = "online",
            ValidationState = "validated",
            IsEnabled = true,
            SourceType = "rtsp_manual",
        };

        _repo.GetByIdAsync(camera.Id, Arg.Any<CancellationToken>()).Returns(camera);

        var result = await _sut.ExecuteAsync(camera.Id, new UpdateCameraRequest(
            "Front Door",
            "192.168.1.10",
            554,
            null,
            null,
            "/Streaming/Channels/102",
            "rtsp_manual"));

        Assert.NotNull(result);
        await _repo.Received(1).UpdateAsync(Arg.Is<Camera>(updated =>
            updated.StreamPath == "/Streaming/Channels/102"
            && updated.ValidationState == "draft"
            && updated.IsEnabled == false
            && updated.Status == "needs_attention"), Arg.Any<CancellationToken>());
    }
}

public class ApplyCameraConfigurationUseCaseTests
{
    private readonly ICameraRepository _repo = Substitute.For<ICameraRepository>();
    private readonly IFrigateConfigApplier _applier = Substitute.For<IFrigateConfigApplier>();
    private readonly ApplyCameraConfigurationUseCase _sut;

    public ApplyCameraConfigurationUseCaseTests() => _sut = new ApplyCameraConfigurationUseCase(_repo, _applier);

    [Fact]
    public async Task Execute_applies_all_online_or_validated_cameras()
    {
        var onlineDraft = new Camera
        {
            Id = "camera-1",
            Slug = "front-door",
            DisplayName = "Front Door",
            Host = "192.168.1.10",
            Port = 554,
            Status = "online",
            ValidationState = "draft",
        };

        var validated = new Camera
        {
            Id = "camera-2",
            Slug = "garage",
            DisplayName = "Garage",
            Host = "192.168.1.11",
            Port = 554,
            Status = "offline",
            ValidationState = "validated",
            IsEnabled = true,
        };

        _repo.GetAllAsync(Arg.Any<CancellationToken>()).Returns([onlineDraft, validated]);
        _applier.ApplyAsync(Arg.Any<IReadOnlyList<Camera>>(), Arg.Any<CancellationToken>())
            .Returns(new FrigateConfigApplyResult(true, "Applied.", "config/frigate.generated.yml"));

        var result = await _sut.ExecuteAsync();

        Assert.True(result.Applied);
        Assert.Equal(2, result.CameraCount);
        await _repo.Received(2).UpdateAsync(Arg.Is<Camera>(camera => camera.ValidationState == "validated" && camera.IsEnabled), Arg.Any<CancellationToken>());
    }
}