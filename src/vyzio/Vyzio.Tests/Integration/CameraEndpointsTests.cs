using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Vyzio.Application.DTOs.Cameras;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.Configuration;
using Vyzio.Infrastructure.Persistence;
using Vyzio.Infrastructure.Services;

namespace Vyzio.Tests.Integration;

public class CameraEndpointsTests : IClassFixture<CamerasApiFactory>
{
    private readonly CamerasApiFactory _factory;

    public CameraEndpointsTests(CamerasApiFactory factory)
    {
        _factory = factory;
        _factory.ResetState();
    }

    [Fact]
    public async Task GetCameras_ShouldReturnTheCatalogWithEachCameraStatus_WhenACameraIsRegistered()
    {
        using var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/cameras");

        response.EnsureSuccessStatusCode();
        var payload = await response.Content.ReadFromJsonAsync<CameraResponse[]>();

        var camera = Assert.Single(payload!);
        Assert.Equal("Front Door", camera.DisplayName);
        Assert.Equal("online", camera.Status);
        Assert.True(camera.PreviewAvailable);
    }

    [Fact]
    public async Task UpdateProtocol_ShouldListTheProtocolWithItsSpecificAccountButNeverItsPassword_WhenAnAccountIsSet()
    {
        // Arrange
        using var client = _factory.CreateClient();

        // Act
        var update = await client.PutAsJsonAsync("/api/cameras/camera-1/protocols/tapo_klap",
            new { port = (int?)null, username = "cloud-user", password = "cloud-pass", deviceId = (uint?)null });
        var listed = await client.GetStringAsync("/api/cameras/camera-1/protocols");

        // Assert
        update.EnsureSuccessStatusCode();
        Assert.Contains("\"protocol\":\"rtsp\"", listed, StringComparison.Ordinal);
        Assert.Contains("\"protocol\":\"tapo_klap\"", listed, StringComparison.Ordinal);
        Assert.Contains("\"hasSpecificAccount\":true", listed, StringComparison.Ordinal);
        Assert.DoesNotContain("cloud-pass", listed, StringComparison.Ordinal);
    }

    [Fact]
    public async Task RemoveProtocol_ShouldRefuseWithItsCode_WhenTheStreamGoesThroughIt()
    {
        // Arrange
        using var client = _factory.CreateClient();

        // Act
        var response = await client.DeleteAsync("/api/cameras/camera-1/protocols/rtsp");

        // Assert
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Contains("protocol_in_use", await response.Content.ReadAsStringAsync(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task TryCapability_ShouldRefuseWithItsCode_WhenTheCapabilityHasNothingToConfirm()
    {
        // Arrange
        using var client = _factory.CreateClient();

        // Act
        var response = await client.PostAsync("/api/cameras/camera-1/capabilities/ptz/try", null);

        // Assert
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Contains("nothing_to_confirm", await response.Content.ReadAsStringAsync(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task ConfirmCapability_ShouldRefuseWithItsCode_WhenTheCapabilityHasNothingToConfirm()
    {
        // Arrange
        using var client = _factory.CreateClient();

        // Act
        var response = await client.PostAsJsonAsync("/api/cameras/camera-1/capabilities/stream/confirm", new { worked = true });

        // Assert
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Contains("nothing_to_confirm", await response.Content.ReadAsStringAsync(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task ConfigureCapability_ShouldRefuseWithItsCode_WhenTheCameraDoesNotHaveTheProtocol()
    {
        // Arrange
        using var client = _factory.CreateClient();

        // Act
        var response = await client.PutAsJsonAsync("/api/cameras/camera-1/capabilities/ptz", new { protocol = "dvrip" });

        // Assert
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Contains("protocol_not_on_camera", await response.Content.ReadAsStringAsync(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task ConfigureStream_ShouldRefuseWithItsCode_WhenTheCameraListsNoStreamOverRtspAndNoPathIsTyped()
    {
        // Arrange
        using var client = _factory.CreateClient();
        await client.PostAsJsonAsync("/api/cameras/camera-1/protocols", new { protocol = "dvrip", port = (int?)null, username = (string?)null, password = (string?)null });
        (await client.PutAsJsonAsync("/api/cameras/camera-1/capabilities/stream", new { protocol = "dvrip" })).EnsureSuccessStatusCode();

        // Act
        var response = await client.PutAsJsonAsync("/api/cameras/camera-1/capabilities/stream", new { protocol = "rtsp" });

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("stream_path_required", await response.Content.ReadAsStringAsync(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task CreateCamera_ShouldCreateTheCameraToSetUpAndNeverDetected_WhenOnlyItsAccessIsGiven()
    {
        // Arrange
        using var client = _factory.CreateClient();

        // Act
        var response = await client.PostAsJsonAsync("/api/cameras", new CreateCameraRequest("Garage", "192.168.1.30", "viewer", "fixture-secret"));

        // Assert
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<CameraResponse>();
        Assert.Equal("to_set_up", created!.Status);
        Assert.Equal("to_set_up", created.ValidationState);
        Assert.Null(created.DetectedAt);
        Assert.Empty((await client.GetFromJsonAsync<object[]>($"/api/cameras/{created.Id}/protocols"))!);
    }

    [Fact]
    public async Task ApplyConfiguration_ShouldLeaveTheCameraOut_WhenItsStreamNeverWorked()
    {
        // Arrange
        using var client = _factory.CreateClient();
        var created = await CreateFromAccessAsync(client, "Garage", "192.168.1.30");

        // Act
        (await client.PostAsync("/api/cameras/apply-configuration", content: null)).EnsureSuccessStatusCode();

        // Assert
        var catalog = await client.GetFromJsonAsync<CameraResponse[]>("/api/cameras");
        var camera = Assert.Single(catalog!, entry => entry.Id == created.Id);
        Assert.Equal("to_set_up", camera.Status);
        Assert.False(camera.IsEnabled);
    }

    [Fact]
    public async Task SaveDetectionConfig_ShouldKeepTheSettings_WhenTheCameraIsToSetUp()
    {
        // Arrange
        using var client = _factory.CreateClient();
        var created = await CreateFromAccessAsync(client, "Garage", "192.168.1.30");

        // Act
        var response = await client.PutAsJsonAsync($"/api/cameras/{created.Id}/detection-config", new SaveCameraDetectionConfigRequest(["person", "dog"], EventClipDaysOverride: 3));

        // Assert
        response.EnsureSuccessStatusCode();
        var saved = await client.GetFromJsonAsync<DetectionConfigResponse>($"/api/cameras/{created.Id}/detection-config");
        Assert.Equal(["person", "dog"], saved!.Labels);
        Assert.Equal(3, saved.Retention.EventClip.Override);
    }

    [Fact]
    public async Task TogglePrivacy_ShouldKeepTheChoice_WhenTheCameraIsToSetUp()
    {
        // Arrange
        using var client = _factory.CreateClient();
        var created = await CreateFromAccessAsync(client, "Garage", "192.168.1.30");

        // Act
        var response = await client.PostAsJsonAsync($"/api/cameras/{created.Id}/privacy/toggle", new { active = true });

        // Assert
        response.EnsureSuccessStatusCode();
        var catalog = await client.GetFromJsonAsync<PrivacyResponse[]>("/api/cameras");
        Assert.True(Assert.Single(catalog!, entry => entry.Id == created.Id).PrivacyModeActive);
    }

    [Fact]
    public async Task SearchProtocols_ShouldAnswerNotFound_WhenTheCameraDoesNotExist()
    {
        // Arrange
        using var client = _factory.CreateClient();

        // Act
        var response = await client.PostAsync("/api/cameras/no-such-camera/protocols/search", null);

        // Assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task AddProtocol_ShouldRefuseItTwiceAndRemoveIt_WhenNoCapabilityUsesIt()
    {
        // Arrange
        using var client = _factory.CreateClient();
        var body = new { protocol = "dvrip", port = (int?)null, username = (string?)null, password = (string?)null };

        // Act
        var added = await client.PostAsJsonAsync("/api/cameras/camera-1/protocols", body);
        var again = await client.PostAsJsonAsync("/api/cameras/camera-1/protocols", body);
        var removed = await client.DeleteAsync("/api/cameras/camera-1/protocols/dvrip");

        // Assert
        added.EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.Conflict, again.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, removed.StatusCode);
    }

    [Fact]
    public async Task RemoveCapability_ShouldRefuseWithABadRequest_WhenTheCapabilityIsTheStream()
    {
        // Arrange
        using var client = _factory.CreateClient();

        // Act
        var response = await client.DeleteAsync("/api/cameras/camera-1/capabilities/stream");

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task SignalPtzMove_ShouldAnswerNotFound_WhenNoMoveOfTheCameraIsHeld()
    {
        // Arrange
        using var client = _factory.CreateClient();

        // Act
        var response = await client.PostAsync("/api/cameras/camera-1/ptz/move/signal", null);

        // Assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task StopPtzMove_ShouldAnswerNoContent_WhenTheMoveAlreadyStopped()
    {
        // Arrange
        using var client = _factory.CreateClient();

        // Act
        var response = await client.PostAsync("/api/cameras/camera-1/ptz/move/stop", null);

        // Assert
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task StartPtzMove_ShouldAnswerABadRequest_WhenTheDirectionIsUnknown()
    {
        // Arrange
        using var client = _factory.CreateClient();

        // Act
        var response = await client.PostAsJsonAsync("/api/cameras/camera-1/ptz/move/start", new { direction = "Sideways", speed = 50 });

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("\"error\":\"unknown_direction\"", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task SetPrivacyStrategy_ShouldAnswerARefusalWithItsCode_WhenParkingHasNoSavedPositions()
    {
        using var client = _factory.CreateClient();

        var response = await client.PatchAsJsonAsync("/api/cameras/camera-1/privacy-strategy", new { strategy = "ptz_parking" });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Contains("parking_positions_missing", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task GetCameraStatus_ShouldReturnNotFound_WhenTheCameraIsUnknown()
    {
        using var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/cameras/unknown/status");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetCameraStatus_ShouldReturnGuidance_WhenTheCameraIsKnown()
    {
        using var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/cameras/camera-1/status");

        response.EnsureSuccessStatusCode();
        var payload = await response.Content.ReadFromJsonAsync<CameraStatusResponse>();

        Assert.NotNull(payload);
        Assert.True(payload!.Connected);
        Assert.False(string.IsNullOrWhiteSpace(payload.Guidance));
    }

    [Fact]
    public async Task Discover_ShouldReturnTheDiscoveryServiceCandidates_WhenNoTargetIsGiven()
    {
        using var client = _factory.CreateClient();

        var response = await client.PostAsync("/api/cameras/discovery", content: null);

        response.EnsureSuccessStatusCode();
        var payload = await response.Content.ReadFromJsonAsync<DiscoveredCameraResponse[]>();

        var candidate = Assert.Single(payload!);
        Assert.Equal("Driveway", candidate.DisplayName);
        Assert.False(candidate.RtspActive);
        Assert.False(candidate.IsSupported);
        Assert.Equal("camera_confirmed", candidate.Qualification);
        Assert.Contains("onvif_detected", candidate.QualificationReasons);
        Assert.Null(candidate.Stream);
    }

    [Fact]
    public async Task Discover_ShouldRefreshOnlyThatTargetWithoutAFullScan_WhenASingleTargetIsGiven()
    {
        using var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/cameras/discovery", new DiscoverCamerasRequest(
            "192.168.1.10",
            554));

        response.EnsureSuccessStatusCode();
        var payload = await response.Content.ReadFromJsonAsync<DiscoveredCameraResponse[]>();

        var candidate = Assert.Single(payload!);
        Assert.Equal("Front Door", candidate.DisplayName);
        Assert.True(candidate.RtspActive);
        Assert.Contains("rtsp_responding", candidate.QualificationReasons);
        Assert.Equal(new DiscoveredStreamResponse("rtsp", 554, "/Streaming/Channels/101"), candidate.Stream);
    }

    [Fact]
    public async Task UpdateCamera_ShouldPersistTheChangesInPlaceAsADraft_WhenTheCameraExists()
    {
        using var client = _factory.CreateClient();

        var response = await client.PutAsJsonAsync("/api/cameras/camera-1", new UpdateCameraRequest(
            "Entry",
            "192.168.1.12",
            null,
            null,
            "rtsp_manual",
            "person_default"));

        response.EnsureSuccessStatusCode();
        var payload = await response.Content.ReadFromJsonAsync<CameraResponse>();

        Assert.NotNull(payload);
        Assert.Equal("Entry", payload!.DisplayName);
        Assert.Equal("draft", payload.ValidationState);
    }

    [Theory]
    [InlineData("v380_pro")]
    [InlineData("tplink_tapo")]
    [InlineData("icsee")]
    public async Task GetVendorAssistance_ShouldReturnTheVendorSheet_WhenTheAddScreenPicksAVendor(string vendorFamily)
    {
        // Arrange
        using var client = _factory.CreateClient();

        // Act
        var response = await client.PostAsJsonAsync("/api/cameras/vendor-assistance", new VendorAssistanceRequestDto(vendorFamily));

        // Assert
        response.EnsureSuccessStatusCode();
        var payload = await response.Content.ReadFromJsonAsync<VendorAssistanceResponse>();
        Assert.NotNull(payload);
        Assert.Equal(vendorFamily, payload!.VendorFamily);
        Assert.False(string.IsNullOrWhiteSpace(payload.Markdown));
    }

    [Fact]
    public async Task GetVendorAsset_ShouldServeTheLocalFileAsText_WhenTheVendorAssetExists()
    {
        using var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/cameras/vendor-assets/ceshi.ini");

        response.EnsureSuccessStatusCode();
        Assert.Equal("text/plain", response.Content.Headers.ContentType?.MediaType);

        var payload = await response.Content.ReadAsStringAsync();
        Assert.False(string.IsNullOrWhiteSpace(payload));
    }

    [Fact]
    public async Task ApplyCamera_ShouldValidateTheCamera_WhenItsStreamWorkedAfterItWasCreated()
    {
        // Arrange
        using var client = _factory.CreateClient();
        var created = await CreateFromAccessAsync(client, "Garage", "192.168.1.30");
        await BindStreamOverDvripAsync(client, created.Id);

        // Act
        var applyResponse = await client.PostAsync($"/api/cameras/{created.Id}/apply", content: null);

        // Assert
        applyResponse.EnsureSuccessStatusCode();
        var applied = await applyResponse.Content.ReadFromJsonAsync<ApplyCameraResponse>();
        Assert.True(applied!.Applied);
        Assert.Equal("validated", applied.Camera.ValidationState);
    }

    [Fact]
    public async Task ApplyConfiguration_ShouldValidateAndEnableTheCamera_WhenItsStreamWorkedAfterItWasCreated()
    {
        // Arrange
        using var client = _factory.CreateClient();
        var created = await CreateFromAccessAsync(client, "Garage", "192.168.1.30");
        var status = await BindStreamOverDvripAsync(client, created.Id);

        // Act
        var applyResponse = await client.PostAsync("/api/cameras/apply-configuration", content: null);

        // Assert
        Assert.Equal("online", status.Status);
        Assert.Equal("draft", status.ValidationState);
        applyResponse.EnsureSuccessStatusCode();
        var payload = await applyResponse.Content.ReadFromJsonAsync<ApplyCameraConfigurationResponse>();
        Assert.True(payload!.Applied);
        var catalog = await client.GetFromJsonAsync<CameraResponse[]>("/api/cameras");
        Assert.Contains(catalog!, camera => camera.Id == created.Id && camera.ValidationState == "validated" && camera.IsEnabled);
    }

    private static async Task<CameraResponse> CreateFromAccessAsync(HttpClient client, string name, string host)
    {
        var response = await client.PostAsJsonAsync("/api/cameras", new CreateCameraRequest(name, host, null, null));
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<CameraResponse>())!;
    }

    // The user's choice on the stream card, the other way a stream gets bound besides detection (ADR-68 b).
    private static async Task<CameraStatusResponse> BindStreamOverDvripAsync(HttpClient client, string cameraId)
    {
        (await client.PostAsJsonAsync($"/api/cameras/{cameraId}/protocols", new { protocol = "dvrip", port = (int?)null, username = (string?)null, password = (string?)null })).EnsureSuccessStatusCode();
        (await client.PutAsJsonAsync($"/api/cameras/{cameraId}/capabilities/stream", new { protocol = "dvrip" })).EnsureSuccessStatusCode();
        return (await client.GetFromJsonAsync<CameraStatusResponse>($"/api/cameras/{cameraId}/status"))!;
    }

    [Fact]
    public async Task DeleteCamera_ShouldMarkItPendingRemovalThenDropIt_WhenTheConfigurationIsApplied()
    {
        using var client = _factory.CreateClient();

        var response = await client.DeleteAsync("/api/cameras/camera-1");

        response.EnsureSuccessStatusCode();
        var deleted = await response.Content.ReadFromJsonAsync<DeleteCameraResponse>();
        Assert.NotNull(deleted);
        Assert.True(deleted!.Deleted);

        var catalogResponse = await client.GetAsync("/api/cameras");
        catalogResponse.EnsureSuccessStatusCode();
        var payload = await catalogResponse.Content.ReadFromJsonAsync<CameraResponse[]>();
        var camera = Assert.Single(payload!);
        Assert.Equal("pending_removal", camera.ValidationState);

        var applyResponse = await client.PostAsync("/api/cameras/apply-configuration", content: null);
        applyResponse.EnsureSuccessStatusCode();

        var refreshedCatalog = await client.GetFromJsonAsync<CameraResponse[]>("/api/cameras");
        Assert.Empty(refreshedCatalog!);
    }

    public sealed record CameraResponse(string Id, string Slug, string DisplayName, string SourceType, string Host, string? Username, string Status, string ValidationState, bool IsEnabled, bool PreviewAvailable, bool NeedsAttention, DateTimeOffset? LastReachabilityCheckAt, DateTimeOffset? LastSuccessfulFrameAt, DateTimeOffset? DetectedAt, string? FrigateCameraName, string? VendorFamily);

    public sealed record PrivacyResponse(string Id, bool PrivacyModeActive);

    public sealed record DetectionConfigResponse(string[] Labels, RetentionResponse Retention);

    public sealed record RetentionResponse(RetentionWindowResponse EventClip);

    public sealed record RetentionWindowResponse(int? Override);

    public sealed record CameraStatusResponse(string CameraId, string DisplayName, string Status, string ValidationState, bool Connected, bool PreviewAvailable, bool NeedsAttention, string? Guidance, DateTimeOffset? LastReachabilityCheckAt, DateTimeOffset? LastSuccessfulFrameAt);

    public sealed record DiscoveredCameraResponse(string DisplayName, string Host, int Port, string SourceType, string? StreamPath, bool RtspActive, string DiscoverySource, string? Note, string? MacAddress, bool IsSupported, string Qualification, string SupportLevel, string? VendorFamily, string[] QualificationReasons, DiscoveredStreamResponse? Stream);

    public sealed record DiscoveredStreamResponse(string Protocol, int Port, string? Path);

    public sealed record VendorAssistanceResponse(string VendorFamily, string Markdown);

    public sealed record ApplyCameraResponse(bool Applied, string Message, string ConfigPath, CameraStatusResponse Camera);

    public sealed record ApplyCameraConfigurationResponse(bool Applied, string Message, string ConfigPath, int CameraCount);

    public sealed record DeleteCameraResponse(bool Deleted, string Message, string ConfigPath);
}

public sealed class CamerasApiFactory : WebApplicationFactory<Program>
{
    private readonly SqliteConnection _connection = new("Data Source=:memory:");

    public void ResetState()
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<VyzioDbContext>();

        SeedDatabase(db);
    }

    private static void SeedDatabase(VyzioDbContext db)
    {
        db.Cameras.RemoveRange(db.Cameras);
        db.SaveChanges();

        db.Cameras.Add(new Camera
        {
            Id = "camera-1",
            Slug = "front-door",
            DisplayName = "Front Door",
            SourceType = "rtsp_manual",
            Host = "192.168.1.10",
            Status = "online",
            ValidationState = CameraValidationState.Validated,
            IsEnabled = true,
            LastReachabilityCheckAt = DateTimeOffset.Parse("2026-05-12T09:00:00+00:00", CultureInfo.InvariantCulture),
            LastSuccessfulFrameAt = DateTimeOffset.Parse("2026-05-12T09:01:00+00:00", CultureInfo.InvariantCulture),
            FrigateCameraName = "front_door"
        }.WithStream(SupportedProtocol.Rtsp));

        db.SaveChanges();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");

        builder.ConfigureServices(services =>
        {
            _connection.Open();

            services.RemoveAll<IHostedService>();
            services.RemoveAll<DbContextOptions<VyzioDbContext>>();
            services.RemoveAll<VyzioDbContext>();
            services.RemoveAll<ICameraDiscoveryService>();
            services.RemoveAll<ICameraVerifier>();
            services.RemoveAll<ICameraProtocolProbe>();
            services.RemoveAll<ICameraStreamEnumerator>();
            services.RemoveAll<IFrigateConfigApplier>();
            services.RemoveAll<IVendorAssistanceService>();
            services.RemoveAll<VyzioRuntimeSettings>();
            services.AddSingleton(new VyzioRuntimeSettings
            {
                Documentation = new VyzioRuntimeSettings.DocumentationSettings
                {
                    VendorCatalogPath = FindRepoPath("src", "vyzio", "vendors")
                }
            });

            services.AddDbContext<VyzioDbContext>(options =>
                options.UseSqlite(_connection)
                       .UseSnakeCaseNamingConvention());

            services.AddSingleton<ICameraDiscoveryService>(new StubCameraDiscoveryService());
            services.AddSingleton<ICameraVerifier>(new StubCameraVerifier());
            services.AddSingleton<ICameraProtocolProbe>(new StubCameraProtocolProbe());
            services.AddSingleton<ICameraStreamEnumerator>(new StubCameraStreamEnumerator());
            services.AddSingleton<IFrigateConfigApplier>(new StubFrigateConfigApplier());
            services.AddSingleton<IVendorAssistanceService, CameraVendorAssistanceService>();

            using var scope = services.BuildServiceProvider().CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<VyzioDbContext>();
            db.Database.Migrate();
            SeedDatabase(db);
            SignedInTestClient.SeedOwnerSession(db);
        });
    }

    protected override void ConfigureClient(HttpClient client)
    {
        base.ConfigureClient(client);
        client.DefaultRequestHeaders.Add("Cookie", SignedInTestClient.Cookie);
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing)
        {
            _connection.Dispose();
        }
    }

    private static string FindRepoPath(params string[] parts)
    {
        var segments = new[] { AppContext.BaseDirectory, "..", "..", "..", "..", "..", ".." }
            .Concat(parts)
            .ToArray();
        return Path.GetFullPath(Path.Combine(segments));
    }

    private sealed class StubCameraDiscoveryService : ICameraDiscoveryService
    {
        public Task<IReadOnlyList<CameraDiscoveryCandidate>> DiscoverAsync(CameraDiscoveryTarget? target = null, CancellationToken ct = default)
            => Task.FromResult<IReadOnlyList<CameraDiscoveryCandidate>>(
                target is not null && string.Equals(target.Host, "192.168.1.10", StringComparison.OrdinalIgnoreCase)
                    ?
                    [
                        new CameraDiscoveryCandidate("Front Door", "192.168.1.10", 554, "rtsp_manual", "/Streaming/Channels/101", "rtsp_describe", "RTSP probe refreshed for this camera.", "AA:BB:CC:DD:EE:FF", "camera_confirmed", "unknown", null, ["rtsp_responding", "mac_address_observed"], Stream: new DiscoveredStream(SupportedProtocol.Rtsp, 554, "/Streaming/Channels/101"))
                    ]
                    :
                    [
                        new CameraDiscoveryCandidate("Front Door", "192.168.1.10", 554, "onvif", null, "onvif", "ONVIF device announced.", "AA:BB:CC:DD:EE:FF", "camera_confirmed", "unknown", null, ["onvif_detected", "mac_address_observed"]),
                        new CameraDiscoveryCandidate("Driveway", "192.168.1.20", 554, "onvif", null, "onvif", "ONVIF device announced.", "AA:BB:CC:DD:EE:FF", "camera_confirmed", "unknown", null, ["onvif_detected", "mac_address_observed"])
                    ]);
    }

    private sealed class StubCameraProtocolProbe : ICameraProtocolProbe
    {
        public Task<ProtocolAnswer> ProbeAsync(Camera camera, SupportedProtocol protocol, CancellationToken ct = default)
            => Task.FromResult(ProtocolAnswer.Answers());
    }

    private sealed class StubCameraVerifier : ICameraVerifier
    {
        public Task<CameraVerificationResult> VerifyAsync(Camera camera, CameraStream? stream, CancellationToken ct = default)
            => Task.FromResult(new CameraVerificationResult(
                true,
                true,
                "online",
                "Camera responded to the stream verification.",
                DateTimeOffset.Parse("2026-05-12T11:00:00+00:00", CultureInfo.InvariantCulture),
                DateTimeOffset.Parse("2026-05-12T11:00:00+00:00", CultureInfo.InvariantCulture)));
    }

    // A verified camera is asked what it serves, over the network, against the address the test
    // invented: without this the suite passes or hangs depending on how the runner's network
    // answers 192.168.x. Empty is the contract's "could not enumerate", so the camera keeps the
    // single stream onboarding gave it.
    private sealed class StubCameraStreamEnumerator : ICameraStreamEnumerator
    {
        public Task<IReadOnlyList<EnumeratedScene>> EnumerateAsync(Camera camera, SupportedProtocol protocol, CancellationToken ct = default)
            => Task.FromResult<IReadOnlyList<EnumeratedScene>>([]);
    }

    private sealed class StubFrigateConfigApplier : IFrigateConfigApplier
    {
        public Task WriteConfigAsync(IReadOnlyList<Camera> cameras, bool changed, CancellationToken ct = default)
            => Task.CompletedTask;

        public Task<FrigateConfigApplyResult> ApplyAsync(IReadOnlyList<Camera> cameras, CancellationToken ct = default)
            => Task.FromResult(new FrigateConfigApplyResult(true, "Frigate configuration applied successfully.", "config/frigate.generated.yml"));

        public bool HasPendingChanges => false;
    }

}
