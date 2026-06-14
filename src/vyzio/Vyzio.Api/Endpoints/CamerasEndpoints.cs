using Microsoft.AspNetCore.StaticFiles;
using Vyzio.Api.Integration.Frigate;
using Vyzio.Application.DTOs.Cameras;
using Vyzio.Application.DTOs.Profiles;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Application.UseCases.Profiles;
using Vyzio.Infrastructure.Configuration;

namespace Vyzio.Api.Endpoints;

// Request types for privacy endpoints
file sealed record TogglePrivacyRequest(bool Active);
file sealed record BatchTogglePrivacyRequest(IReadOnlyList<string> CameraIds, bool Active);

public static class CamerasEndpoints
{
    private static readonly FileExtensionContentTypeProvider ContentTypeProvider = new();

    public static IEndpointRouteBuilder MapCameras(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/cameras");

        group.MapPost("/discovery", async (DiscoverCamerasRequest? request, DiscoverCamerasUseCase useCase, ILoggerFactory loggerFactory, CancellationToken ct) =>
        {
            var logger = loggerFactory.CreateLogger("CamerasDiscovery");
            logger.LogInformation("HTTP camera discovery request received.");

            var result = await useCase.ExecuteAsync(request, ct);

            logger.LogInformation("HTTP camera discovery request completed with {CandidateCount} candidate(s).", result.Count);
            return Results.Ok(result);
        });

        group.MapPost("/vendor-assistance", async (VendorAssistanceRequestDto request, GetVendorAssistanceUseCase useCase, CancellationToken ct) =>
        {
            var result = await useCase.ExecuteAsync(request, ct);
            return Results.Json(result);
        });

        group.MapGet("/vendor-assets/{**assetPath}", GetVendorAsset);

        group.MapGet("/", async (GetCamerasUseCase useCase, CancellationToken ct) =>
            Results.Ok(await useCase.ExecuteAsync(ct)));

        group.MapPost("/", async (CreateCameraRequest request, CreateCameraUseCase useCase, CancellationToken ct) =>
        {
            var dto = await useCase.ExecuteAsync(request, ct);
            return Results.Created($"/api/cameras/{dto.Id}", dto);
        });

        group.MapPut("/{id}", async (string id, UpdateCameraRequest request, UpdateCameraUseCase useCase, CancellationToken ct) =>
        {
            var dto = await useCase.ExecuteAsync(id, request, ct);
            return dto is null ? Results.NotFound() : Results.Ok(dto);
        });

        group.MapPost("/verify-draft", async (CreateCameraRequest request, VerifyDraftCameraUseCase useCase, CancellationToken ct) =>
            Results.Ok(await useCase.ExecuteAsync(request, ct)));

        group.MapGet("/{id}/status", async (string id, GetCameraStatusUseCase useCase, CancellationToken ct) =>
        {
            var status = await useCase.ExecuteAsync(id, ct);
            return status is null ? Results.NotFound() : Results.Ok(status);
        });

        group.MapPost("/{id}/verify", async (string id, VerifyCameraUseCase useCase, CancellationToken ct) =>
        {
            var status = await useCase.ExecuteAsync(id, ct);
            return status is null ? Results.NotFound() : Results.Ok(status);
        });

        group.MapPost("/{id}/apply", async (string id, ApplyCameraUseCase useCase, CancellationToken ct) =>
        {
            var result = await useCase.ExecuteAsync(id, ct);
            return result is null ? Results.NotFound() : Results.Ok(result);
        });

        group.MapPost("/apply-configuration", async (ApplyCameraConfigurationUseCase useCase, CancellationToken ct) =>
            Results.Ok(await useCase.ExecuteAsync(ct)));

        group.MapDelete("/{id}", async (string id, DeleteCameraUseCase useCase, CancellationToken ct) =>
        {
            var result = await useCase.ExecuteAsync(id, ct);
            return result is null ? Results.NotFound() : Results.Ok(result);
        });

        // Detection config
        group.MapGet("/{id}/detection-config", async (string id, GetCameraDetectionConfigUseCase useCase, CancellationToken ct) =>
        {
            var dto = await useCase.ExecuteAsync(id, ct);
            return dto is null ? Results.NotFound() : Results.Ok(dto);
        });

        group.MapPut("/{id}/detection-config", async (
            string id,
            SaveCameraDetectionConfigRequest request,
            SaveCameraDetectionConfigUseCase useCase,
            CancellationToken ct) =>
        {
            var dto = await useCase.ExecuteAsync(id, request, ct);
            return dto is null ? Results.NotFound() : Results.Ok(dto);
        });

        // Live feed — latest frame proxy (ADR-16)
        group.MapGet("/{id}/live/latest.jpg", async (string id, GetCamerasUseCase getCameras, IFrigateRestClient frigateClient, CancellationToken ct) =>
        {
            var cameras = await getCameras.ExecuteAsync(ct);
            var camera = cameras.FirstOrDefault(c => c.Id == id);
            if (camera is null) return Results.NotFound();

            var frigateCamera = camera.FrigateCameraName ?? camera.Slug.Replace('-', '_');
            var response = await frigateClient.GetLatestFrameAsync(frigateCamera, ct);
            if (!response.IsSuccessStatusCode)
                return Results.StatusCode((int)response.StatusCode);

            var stream = await response.Content.ReadAsStreamAsync(ct);
            return Results.Stream(stream, "image/jpeg");
        });

        // Privacy mode — toggle unitaire
        group.MapPost("/{id}/privacy/toggle", async (string id, TogglePrivacyRequest request, ToggleCameraPrivacyModeUseCase useCase, CancellationToken ct) =>
        {
            var dto = await useCase.ExecuteAsync(id, request.Active, "manual", ct);
            return dto is null ? Results.NotFound() : Results.Ok(dto);
        });

        // Privacy mode — toggle batch (un seul reload Frigate)
        group.MapPost("/privacy/batch-toggle", async (BatchTogglePrivacyRequest request, BatchToggleCameraPrivacyModeUseCase useCase, CancellationToken ct) =>
            Results.Ok(await useCase.ExecuteAsync(request.CameraIds, request.Active, ct)));

        // Privacy schedules
        group.MapGet("/{id}/privacy/schedules", async (string id, GetCameraPrivacySchedulesUseCase useCase, CancellationToken ct) =>
            Results.Ok(await useCase.ExecuteAsync(id, ct)));

        group.MapPost("/{id}/privacy/schedules", async (string id, CreatePrivacyScheduleRequest request, CreateCameraPrivacyScheduleUseCase useCase, CancellationToken ct) =>
        {
            var dto = await useCase.ExecuteAsync(id, request, ct);
            return dto is null ? Results.NotFound() : Results.Created($"/api/cameras/{id}/privacy/schedules/{dto.Id}", dto);
        });

        group.MapPatch("/{id}/privacy/schedules/{scheduleId}", async (string id, string scheduleId, UpdatePrivacyScheduleRequest request, UpdateCameraPrivacyScheduleUseCase useCase, CancellationToken ct) =>
        {
            var dto = await useCase.ExecuteAsync(scheduleId, request, ct);
            return dto is null ? Results.NotFound() : Results.Ok(dto);
        });

        group.MapDelete("/{id}/privacy/schedules/{scheduleId}", async (string id, string scheduleId, DeleteCameraPrivacyScheduleUseCase useCase, CancellationToken ct) =>
        {
            var deleted = await useCase.ExecuteAsync(scheduleId, ct);
            return deleted ? Results.NoContent() : Results.NotFound();
        });

        // Profile links
        group.MapGet("/{id}/profile-links", async (string id, GetCameraProfileLinksUseCase useCase, CancellationToken ct) =>
            Results.Ok(await useCase.ExecuteAsync(id, ct)));

        group.MapPut("/{id}/profile-links", async (
            string id,
            SetCameraProfileLinksRequest request,
            SetCameraProfileLinksUseCase useCase,
            CancellationToken ct) =>
        {
            var links = await useCase.ExecuteAsync(id, request, ct);
            return Results.Ok(links);
        });

        return app;
    }

    private static IResult GetVendorAsset(string assetPath, VyzioRuntimeSettings settings)
    {
        var catalogPath = settings.Documentation.VendorCatalogPath;
        if (string.IsNullOrWhiteSpace(catalogPath) || string.IsNullOrWhiteSpace(assetPath))
        {
            return Results.NotFound();
        }

        var assetRoot = Path.GetFullPath(Path.Combine(catalogPath, "assets"));
        var requestedPath = Path.GetFullPath(Path.Combine(assetRoot, assetPath));

        if (!requestedPath.StartsWith(assetRoot, StringComparison.OrdinalIgnoreCase) || !File.Exists(requestedPath))
        {
            return Results.NotFound();
        }

        var contentType = ContentTypeProvider.TryGetContentType(requestedPath, out var resolvedContentType)
            ? resolvedContentType
            : string.Equals(Path.GetExtension(requestedPath), ".ini", StringComparison.OrdinalIgnoreCase)
                ? "text/plain"
                : "application/octet-stream";

        return Results.File(File.OpenRead(requestedPath), contentType, enableRangeProcessing: true);
    }
}