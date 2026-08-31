using Microsoft.AspNetCore.StaticFiles;
using Vyzio.Core.Interfaces;
using Vyzio.Application.DTOs.Cameras;
using Vyzio.Application.DTOs.Profiles;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Application.UseCases.Profiles;
using Vyzio.Core.Common;
using Vyzio.Core.Entities;
using Vyzio.Infrastructure.Configuration;

namespace Vyzio.Api.Endpoints;

// Request type for capability endpoints
file sealed record ConfigureCameraCapabilityRequest(string Protocol, string? ConfigJson);

// Request types for privacy endpoints
file sealed record TogglePrivacyRequest(bool Active);
file sealed record BatchTogglePrivacyRequest(IReadOnlyList<string> CameraIds, bool Active);

// Request types for PTZ endpoints
file sealed record PtzStepApiRequest(string Direction, int Speed = 50);
file sealed record PtzPresetApiRequest(int PresetId);
file sealed record PrivacyStrategyApiRequest(string Strategy);

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
        group.MapGet("/{id}/live/latest.jpg", async (string id, GetCamerasUseCase getCameras, IFrigateLiveFrameProvider frames, CancellationToken ct) =>
        {
            var cameras = await getCameras.ExecuteAsync(ct);
            var camera = cameras.FirstOrDefault(c => c.Id == id);
            if (camera is null) return Results.NotFound();

            var frigateCamera = camera.FrigateCameraName;
            var frame = await frames.TryGetLatestFrameAsync(frigateCamera, ct);
            if (frame is null) return Results.NotFound();

            return Results.File(frame, "image/jpeg");
        });

        // Privacy mode — toggle unitaire
        group.MapPost("/{id}/privacy/toggle", async (string id, TogglePrivacyRequest request, ToggleCameraPrivacyModeUseCase useCase, CancellationToken ct) =>
        {
            var dto = await useCase.ExecuteAsync(id, request.Active, Vyzio.Core.Entities.PrivacyModeSource.Manual, ct);
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

        // PTZ control — single step endpoint handles both tap (durationMs=80) and hold (chained calls)
        group.MapPost("/{id}/ptz/step", async (string id, PtzStepApiRequest request, PtzStepUseCase useCase, CancellationToken ct) =>
        {
            try
            {
                var ok = await useCase.ExecuteAsync(id, new PtzMoveRequest(request.Direction, request.Speed), ct);
                return ok ? Results.NoContent() : Results.NotFound();
            }
            catch (ArgumentException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        group.MapPost("/{id}/ptz/preset/save", async (string id, PtzPresetApiRequest request, PtzSavePresetUseCase useCase, CancellationToken ct) =>
        {
            try
            {
                var ok = await useCase.ExecuteAsync(id, request.PresetId, ct);
                return ok ? Results.NoContent() : Results.NotFound();
            }
            catch (PtzNotCalibratedException)
            {
                return Results.Conflict(new { error = "not_calibrated" });
            }
        });

        group.MapPost("/{id}/ptz/preset/goto", async (string id, PtzPresetApiRequest request, PtzGoToPresetUseCase useCase, CancellationToken ct) =>
        {
            var ok = await useCase.ExecuteAsync(id, request.PresetId, ct);
            return ok ? Results.NoContent() : Results.NotFound();
        });

        // Branch B calibration: homes the camera to establish virtual position (0,0).
        group.MapPost("/{id}/ptz/calibrate", async (string id, PtzCalibrateUseCase useCase, CancellationToken ct) =>
        {
            var ok = await useCase.ExecuteAsync(id, ct);
            return ok ? Results.NoContent() : Results.NotFound();
        });

        // Returns all configured PTZ presets for a camera, plus calibration state and current position (ADR-25).
        group.MapGet("/{id}/ptz/presets", async (string id, GetPtzPresetsUseCase useCase, CancellationToken ct) =>
        {
            var (list, calibrated, pos) = await useCase.ExecuteAsync(id, ct);
            return Results.Ok(new
            {
                calibrated,
                currentPosition = pos is { } p ? new { x = p.X, y = p.Y } : null,
                presets = list.Select(p => new
                {
                    presetId = p.PresetId,
                    label = p.Label,
                    native = p.Native,
                    stepsX = p.StepsX,
                    stepsY = p.StepsY,
                    configured = true,
                }),
            });
        });

        // Diagnostic: check if camera supports position reporting (needed for AbsoluteMove home).
        group.MapGet("/{id}/ptz/position", async (string id, GetPtzPositionUseCase useCase, CancellationToken ct) =>
        {
            var pos = await useCase.ExecuteAsync(id, ct);
            if (pos is null) return Results.Ok(new { supported = false, pan = (float?)null, tilt = (float?)null });
            return Results.Ok(new { supported = true, pan = pos.Value.Pan, tilt = pos.Value.Tilt });
        });

        // Privacy strategy selection
        group.MapPatch("/{id}/privacy-strategy", async (string id, PrivacyStrategyApiRequest request, SetCameraPrivacyStrategyUseCase useCase, CancellationToken ct) =>
        {
            try
            {
                var dto = await useCase.ExecuteAsync(id, new SetPrivacyStrategyRequest(request.Strategy), ct);
                return dto is null ? Results.NotFound() : Results.Ok(dto);
            }
            catch (ArgumentException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        // Capability bindings (ADR-22) — lists, configures and probes camera capabilities
        group.MapGet("/{id}/capabilities", async (string id, GetCameraCapabilitiesUseCase useCase, CancellationToken ct) =>
        {
            var list = await useCase.ExecuteAsync(id, ct);
            return list is null ? Results.NotFound() : Results.Ok(list);
        });

        group.MapPut("/{id}/capabilities/{capability}", async (
            string id,
            string capability,
            ConfigureCameraCapabilityRequest request,
            ConfigureCameraCapabilityUseCase useCase,
            CancellationToken ct) =>
        {
            try
            {
                var binding = await useCase.ExecuteAsync(id, new Vyzio.Application.UseCases.Cameras.ConfigureCameraCapabilityRequest(capability, request.Protocol, request.ConfigJson), ct);
                return binding is null ? Results.NotFound() : Results.Ok(binding);
            }
            catch (ArgumentException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        group.MapDelete("/{id}/capabilities/{capability}", async (
            string id,
            string capability,
            RemoveCameraCapabilityUseCase useCase,
            CancellationToken ct) =>
        {
            if (!SnakeCaseEnum.TryFromSnakeCase<CameraCapability>(capability, out var cap))
                return Results.BadRequest(new { error = $"Unknown capability: {capability}" });

            var removed = await useCase.ExecuteAsync(id, cap, ct);
            return removed ? Results.NoContent() : Results.NotFound();
        });

        group.MapPost("/{id}/capabilities/{capability}/probe", async (
            string id,
            string capability,
            ProbeCameraCapabilityUseCase useCase,
            CancellationToken ct) =>
        {
            if (!SnakeCaseEnum.TryFromSnakeCase<CameraCapability>(capability, out var cap))
                return Results.BadRequest(new { error = $"Unknown capability: {capability}" });

            var result = await useCase.ExecuteAsync(id, cap, ct);
            return result is null ? Results.NotFound() : Results.Ok(result);
        });

        group.MapPost("/{id}/capabilities/detect", async (
            string id,
            SeedAndProbePresetsUseCase useCase,
            ICameraRepository cameras,
            CancellationToken ct) =>
        {
            var camera = await cameras.GetByIdAsync(id, ct);
            if (camera is null) return Results.NotFound();
            await useCase.ExecuteAsync(id, ct);
            return Results.NoContent();
        });

        // Image settings (ADR-27) — read/write live on the camera, nothing persisted on Vyzio's side.
        group.MapGet("/{id}/image-settings", async (string id, GetCameraImageSettingsUseCase useCase, CancellationToken ct) =>
        {
            var settings = await useCase.ExecuteAsync(id, ct);
            return settings is null ? Results.NotFound() : Results.Ok(settings);
        });

        group.MapPut("/{id}/image-settings", async (
            string id,
            CameraImageSettingsDto request,
            SetCameraImageSettingsUseCase useCase,
            CancellationToken ct) =>
        {
            var settings = await useCase.ExecuteAsync(id, request, ct);
            return settings is null ? Results.NotFound() : Results.Ok(settings);
        });

        // PTZ preset thumbnail — capture current Frigate frame and persist per preset
        group.MapPost("/{id}/ptz/presets/{presetId}/snapshot", async (
            string id, int presetId,
            GetCamerasUseCase getCameras,
            IFrigateLiveFrameProvider frames,
            IPtzThumbnailStore thumbnailStore,
            CancellationToken ct) =>
        {
            var cameras = await getCameras.ExecuteAsync(ct);
            var camera = cameras.FirstOrDefault(c => c.Id == id);
            if (camera is null) return Results.NotFound();

            var slug = camera.FrigateCameraName;
            var bytes = await frames.TryGetLatestFrameAsync(slug, ct);
            if (bytes is null)
                return Results.Problem("Could not retrieve frame from Frigate");

            await thumbnailStore.SaveAsync(id, presetId, bytes, ct);
            return Results.NoContent();
        });

        group.MapGet("/{id}/ptz/presets/{presetId}/thumbnail", async (
            string id, int presetId,
            IPtzThumbnailStore thumbnailStore,
            CancellationToken ct) =>
        {
            var stream = await thumbnailStore.TryGetAsync(id, presetId, ct);
            return stream is null ? Results.NotFound() : Results.Stream(stream, "image/jpeg");
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