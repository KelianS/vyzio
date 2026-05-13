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
using Vyzio.Infrastructure.Persistence;

namespace Vyzio.Tests.Integration;

public class CameraEndpointsTests : IClassFixture<CamerasApiFactory>
{
    private readonly CamerasApiFactory _factory;

    public CameraEndpointsTests(CamerasApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task GetCameras_returns_catalog_with_status_projection()
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
    public async Task GetCameraStatus_returns_not_found_for_unknown_camera()
    {
        using var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/cameras/unknown/status");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetCameraStatus_returns_guidance_for_known_camera()
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
    public async Task Discover_returns_candidates_from_discovery_service()
    {
        using var client = _factory.CreateClient();

        var response = await client.PostAsync("/api/cameras/discovery", content: null);

        response.EnsureSuccessStatusCode();
        var payload = await response.Content.ReadFromJsonAsync<DiscoveredCameraResponse[]>();

        var candidate = Assert.Single(payload!);
        Assert.Equal("Driveway", candidate.DisplayName);
        Assert.Equal("camera_confirmed", candidate.Qualification);
        Assert.Contains("onvif_detected", candidate.QualificationReasons);
    }

    [Fact]
    public async Task Vendor_assistance_returns_markdown_from_dedicated_route()
    {
        using var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/cameras/vendor-assistance", new VendorAssistanceRequestDto(
            "v380_pro",
            null,
            false));

        response.EnsureSuccessStatusCode();
        var payload = await response.Content.ReadFromJsonAsync<VendorAssistanceResponse>();

        Assert.NotNull(payload);
        Assert.Equal("v380_pro", payload!.VendorFamily);
        Assert.Contains("# V380 PRO", payload.Markdown);
    }

    [Fact]
    public async Task Create_verify_and_apply_camera_flow_updates_catalog()
    {
        using var client = _factory.CreateClient();

        var createResponse = await client.PostAsJsonAsync("/api/cameras", new CreateCameraRequest(
            "Garage",
            "192.168.1.30",
            554,
            null,
            null,
            "/Streaming/Channels/101",
            "rtsp_manual",
            "person_default"));

        createResponse.EnsureSuccessStatusCode();
        var created = await createResponse.Content.ReadFromJsonAsync<CameraResponse>();
        Assert.NotNull(created);

        var verifyResponse = await client.PostAsync($"/api/cameras/{created!.Id}/verify", content: null);
        verifyResponse.EnsureSuccessStatusCode();
        var verified = await verifyResponse.Content.ReadFromJsonAsync<CameraStatusResponse>();
        Assert.NotNull(verified);
        Assert.Equal("online", verified!.Status);

        var applyResponse = await client.PostAsync($"/api/cameras/{created.Id}/apply", content: null);
        applyResponse.EnsureSuccessStatusCode();
        var applied = await applyResponse.Content.ReadFromJsonAsync<ApplyCameraResponse>();
        Assert.NotNull(applied);
        Assert.True(applied!.Applied);
        Assert.Equal("validated", applied.Camera.ValidationState);
    }

    [Fact]
    public async Task Delete_camera_removes_it_from_catalog()
    {
        using var client = _factory.CreateClient();

        var response = await client.DeleteAsync("/api/cameras/camera-1");

        response.EnsureSuccessStatusCode();

        var catalogResponse = await client.GetAsync("/api/cameras");
        catalogResponse.EnsureSuccessStatusCode();
        var payload = await catalogResponse.Content.ReadFromJsonAsync<CameraResponse[]>();
        Assert.Empty(payload!);

        var restoreResponse = await client.PostAsJsonAsync("/api/cameras", new CreateCameraRequest(
            "Front Door",
            "192.168.1.10",
            554,
            null,
            null,
            "/Streaming/Channels/101",
            "rtsp_manual",
            "person_default"));

        restoreResponse.EnsureSuccessStatusCode();
        var restored = await restoreResponse.Content.ReadFromJsonAsync<CameraResponse>();
        Assert.NotNull(restored);

        var verifyResponse = await client.PostAsync($"/api/cameras/{restored!.Id}/verify", content: null);
        verifyResponse.EnsureSuccessStatusCode();
    }

    public sealed record CameraResponse(string Id, string Slug, string DisplayName, string SourceType, string Host, int Port, string Status, string ValidationState, bool IsEnabled, bool PreviewAvailable, bool NeedsAttention, DateTimeOffset? LastReachabilityCheckAt, DateTimeOffset? LastSuccessfulFrameAt, string? FrigateCameraName);

    public sealed record CameraStatusResponse(string CameraId, string DisplayName, string Status, string ValidationState, bool Connected, bool PreviewAvailable, bool NeedsAttention, string? Guidance, DateTimeOffset? LastReachabilityCheckAt, DateTimeOffset? LastSuccessfulFrameAt);

    public sealed record DiscoveredCameraResponse(string DisplayName, string Host, int Port, string SourceType, string? StreamPath, string DiscoverySource, string? Note, string? MacAddress, string Qualification, string SupportLevel, string? VendorFamily, string[] QualificationReasons);

    public sealed record VendorAssistanceResponse(string VendorFamily, string Markdown);

    public sealed record ApplyCameraResponse(bool Applied, string Message, string ConfigPath, CameraStatusResponse Camera);

    public sealed record DeleteCameraResponse(bool Deleted, string Message, string ConfigPath);
}

public sealed class CamerasApiFactory : WebApplicationFactory<Program>
{
    private readonly SqliteConnection _connection = new("Data Source=:memory:");

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.UseSetting("VYZIO_CONFIG_PATH", FindRepoFile("config", "vyzio.yml"));

        builder.ConfigureServices(services =>
        {
            _connection.Open();

            services.RemoveAll<IHostedService>();
            services.RemoveAll<DbContextOptions<VyzioDbContext>>();
            services.RemoveAll<VyzioDbContext>();
            services.RemoveAll<ICameraDiscoveryService>();
            services.RemoveAll<ICameraVerifier>();
            services.RemoveAll<IFrigateConfigApplier>();
            services.RemoveAll<IVendorAssistanceService>();

            services.AddDbContext<VyzioDbContext>(options =>
                options.UseSqlite(_connection)
                       .UseSnakeCaseNamingConvention());

            services.AddSingleton<ICameraDiscoveryService>(new StubCameraDiscoveryService());
            services.AddSingleton<ICameraVerifier>(new StubCameraVerifier());
            services.AddSingleton<IFrigateConfigApplier>(new StubFrigateConfigApplier());
            services.AddSingleton<IVendorAssistanceService>(new StubVendorAssistanceService());

            using var scope = services.BuildServiceProvider().CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<VyzioDbContext>();
            db.Database.Migrate();

            db.Cameras.Add(new Camera
            {
                Id = "camera-1",
                Slug = "front-door",
                DisplayName = "Front Door",
                SourceType = "rtsp_manual",
                Host = "192.168.1.10",
                Port = 554,
                Status = "online",
                ValidationState = "validated",
                IsEnabled = true,
                LastReachabilityCheckAt = DateTimeOffset.Parse("2026-05-12T09:00:00+00:00"),
                LastSuccessfulFrameAt = DateTimeOffset.Parse("2026-05-12T09:01:00+00:00"),
                FrigateCameraName = "front_door"
            });

            db.SaveChanges();
        });
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing)
        {
            _connection.Dispose();
        }
    }

    private static string FindRepoFile(params string[] segments)
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);

        while (directory is not null)
        {
            var candidate = Path.Combine(directory.FullName, segments[0], segments.Length > 1 ? Path.Combine(segments[1..]) : string.Empty);
            if (File.Exists(candidate))
            {
                return candidate;
            }

            directory = directory.Parent;
        }

        throw new FileNotFoundException($"Unable to locate {Path.Combine(segments)} from test output directory.");
    }

    private sealed class StubCameraDiscoveryService : ICameraDiscoveryService
    {
        public Task<IReadOnlyList<CameraDiscoveryCandidate>> DiscoverAsync(CancellationToken ct = default)
            => Task.FromResult<IReadOnlyList<CameraDiscoveryCandidate>>(
            [
                new CameraDiscoveryCandidate("Driveway", "192.168.1.20", 554, "onvif", null, "onvif", "ONVIF device announced.", "AA:BB:CC:DD:EE:FF", "camera_confirmed", "unknown", null, ["onvif_detected", "mac_address_observed"])
            ]);
    }

    private sealed class StubCameraVerifier : ICameraVerifier
    {
        public Task<CameraVerificationResult> VerifyAsync(Camera camera, CancellationToken ct = default)
            => Task.FromResult(new CameraVerificationResult(
                true,
                true,
                "online",
                "Camera responded to the stream verification.",
                DateTimeOffset.Parse("2026-05-12T11:00:00+00:00"),
                DateTimeOffset.Parse("2026-05-12T11:00:00+00:00")));
    }

    private sealed class StubFrigateConfigApplier : IFrigateConfigApplier
    {
        public Task<FrigateConfigApplyResult> ApplyAsync(IReadOnlyList<Camera> cameras, CancellationToken ct = default)
            => Task.FromResult(new FrigateConfigApplyResult(true, "Frigate configuration applied successfully.", "config/frigate.generated.yml"));
    }

    private sealed class StubVendorAssistanceService : IVendorAssistanceService
    {
        public Task<VendorDocumentation?> GetAssistanceAsync(string? vendorFamily, string? streamPath, bool connected, CancellationToken ct = default)
            => Task.FromResult(vendorFamily == "v380_pro" && string.IsNullOrWhiteSpace(streamPath) && !connected
                ? new VendorDocumentation(vendorFamily, "# V380 PRO\n\nNotice RTSP de test.")
                : null);
    }
}