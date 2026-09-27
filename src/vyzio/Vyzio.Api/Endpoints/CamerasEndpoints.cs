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

// Request types for capability and protocol endpoints (ADR-61)
file sealed record ConfigureCameraCapabilityRequest(string Protocol);
file sealed record StreamPathApiRequest(string? Path);

// Request types for privacy endpoints
file sealed record TogglePrivacyRequest(bool Active);
file sealed record BatchTogglePrivacyRequest(IReadOnlyList<string> CameraIds, bool Active);

// Request types for PTZ endpoints
file sealed record PtzMoveApiRequest(string Direction, int Speed = 50);
file sealed record PtzPresetApiRequest(int PresetId);
file sealed record PrivacyStrategyApiRequest(string Strategy);
file sealed record PtzPanInvertedApiRequest(bool Inverted);

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
            try
            {
                var dto = await useCase.ExecuteAsync(request, ct);
                return Results.Created($"/api/cameras/{dto.Id}", dto);
            }
            catch (ArgumentException ex)
            {
                return Results.BadRequest(new { error = "invalid_camera", message = ex.Message });
            }
        });

        group.MapPut("/{id}", async (string id, UpdateCameraRequest request, UpdateCameraUseCase useCase, CancellationToken ct) =>
        {
            var dto = await useCase.ExecuteAsync(id, request, ct);
            return dto is null ? Results.NotFound() : Results.Ok(dto);
        });

        group.MapPost("/verify-draft", async (CreateCameraRequest request, VerifyDraftCameraUseCase useCase, CancellationToken ct) =>
        {
            try
            {
                return Results.Ok(await useCase.ExecuteAsync(request, ct));
            }
            catch (ArgumentException ex)
            {
                return Results.BadRequest(new { error = "invalid_camera", message = ex.Message });
            }
        });

        group.MapGet("/{id}/status", async (string id, GetCameraStatusUseCase useCase, CancellationToken ct) =>
        {
            var status = await useCase.ExecuteAsync(id, ct);
            return status is null ? Results.NotFound() : Results.Ok(status);
        });

        group.MapPost("/{id}/verify", async (string id, VerifyCameraUseCase useCase, CancellationToken ct) =>
        {
            var status = await useCase.ExecuteAsync(id, ct: ct);
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

        // Every press is a start, a signal while it lasts and a stop (ADR-60); an unknown direction is named for the interface.
        group.MapPost("/{id}/ptz/move/start", async (string id, PtzMoveApiRequest request, PtzStartMoveUseCase useCase, CancellationToken ct) =>
        {
            try
            {
                return await useCase.ExecuteAsync(id, new PtzMoveRequest(request.Direction, request.Speed), ct) ? Results.NoContent() : Results.NotFound();
            }
            catch (ArgumentException ex)
            {
                return Results.BadRequest(new { error = "unknown_direction", message = ex.Message });
            }
        });

        group.MapPost("/{id}/ptz/move/signal", (string id, PtzSignalMoveUseCase useCase) =>
            useCase.Execute(id) ? Results.NoContent() : Results.NotFound());

        // No CancellationToken: a stop goes out even when the page that asked for it is gone.
        group.MapPost("/{id}/ptz/move/stop", async (string id, PtzStopMoveUseCase useCase) =>
        {
            await useCase.ExecuteAsync(id);
            return Results.NoContent();
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
                    panMs = p.PanMs,
                    tiltMs = p.TiltMs,
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
            catch (ParkingPositionsMissingException ex)
            {
                return Results.Conflict(new { error = "parking_positions_missing", message = ex.Message });
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
                var binding = await useCase.ExecuteAsync(id, new Vyzio.Application.UseCases.Cameras.ConfigureCameraCapabilityRequest(capability, request.Protocol), ct);
                return binding is null ? Results.NotFound() : Results.Ok(binding);
            }
            catch (ProtocolNotOnCameraException ex)
            {
                return Results.Conflict(new { error = "protocol_not_on_camera", message = ex.Message });
            }
            catch (ArgumentException ex)
            {
                return Results.BadRequest(new { error = "invalid_capability_request", message = ex.Message });
            }
        });

        group.MapPut("/{id}/capabilities/stream/path", async (string id, StreamPathApiRequest request, SetStreamPathUseCase useCase, CancellationToken ct) =>
        {
            var binding = await useCase.ExecuteAsync(id, request.Path, ct);
            return binding is null ? Results.NotFound() : Results.Ok(binding);
        });

        group.MapPut("/{id}/capabilities/ptz/pan-inverted", async (string id, PtzPanInvertedApiRequest request, SetPtzPanInvertedUseCase useCase, CancellationToken ct) =>
        {
            var binding = await useCase.ExecuteAsync(id, request.Inverted, ct);
            return binding is null ? Results.NotFound() : Results.Ok(binding);
        });

        group.MapDelete("/{id}/capabilities/{capability}", async (
            string id,
            string capability,
            RemoveCameraCapabilityUseCase useCase,
            CancellationToken ct) =>
        {
            if (!SnakeCaseEnum.TryFromSnakeCase<CameraCapability>(capability, out var cap))
                return Results.BadRequest(new { error = $"Unknown capability: {capability}" });

            try
            {
                var removed = await useCase.ExecuteAsync(id, cap, ct);
                return removed ? Results.NoContent() : Results.NotFound();
            }
            catch (ArgumentException ex)
            {
                return Results.BadRequest(new { error = "stream_not_removable", message = ex.Message });
            }
        });

        group.MapPost("/{id}/capabilities/{capability}/probe", async (
            string id,
            string capability,
            ProbeCameraCapabilityUseCase useCase,
            CancellationToken ct) =>
        {
            if (!SnakeCaseEnum.TryFromSnakeCase<CameraCapability>(capability, out var cap))
                return Results.BadRequest(new { error = $"Unknown capability: {capability}" });

            // The gesture after changing something on the camera: re-resolve, never trust the cache (ADR-56).
            var result = await useCase.ExecuteAsync(id, cap, rediscoverEndpoints: true, ct: ct);
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

        // Protocols (ADR-61): how each one is reached, and whether it answers.
        group.MapGet("/{id}/protocols", async (string id, GetCameraProtocolsUseCase useCase, CancellationToken ct) =>
        {
            var list = await useCase.ExecuteAsync(id, ct);
            return list is null ? Results.NotFound() : Results.Ok(list);
        });

        group.MapPost("/{id}/protocols", async (string id, AddCameraProtocolRequest request, AddCameraProtocolUseCase useCase, CancellationToken ct) =>
        {
            var result = await useCase.ExecuteAsync(id, request, ct);
            return result.Outcome switch
            {
                AddProtocolOutcome.Added => Results.Ok(result.Protocol),
                AddProtocolOutcome.CameraNotFound => Results.NotFound(),
                AddProtocolOutcome.UnknownProtocol => Results.BadRequest(new { error = "unknown_protocol", message = $"Unknown protocol: {request.Protocol}" }),
                AddProtocolOutcome.AlreadySpoken => Results.Conflict(new { error = "protocol_exists", message = $"The camera already speaks {request.Protocol}." }),
                _ => throw new InvalidOperationException($"Unhandled outcome {result.Outcome}."),
            };
        });

        // Level 2 alone: the candidate protocols that answer are added, no capability is touched (ADR-61 d).
        group.MapPost("/{id}/protocols/search", async (string id, SearchCameraProtocolsUseCase useCase, CancellationToken ct) =>
        {
            var list = await useCase.ExecuteAsync(id, ct);
            return list is null ? Results.NotFound() : Results.Ok(list);
        });

        group.MapDelete("/{id}/protocols/{protocol}", async (string id, string protocol, RemoveCameraProtocolUseCase useCase, CancellationToken ct) =>
        {
            if (!SnakeCaseEnum.TryFromSnakeCase<SupportedProtocol>(protocol, out var parsed))
                return Results.BadRequest(new { error = "unknown_protocol", message = $"Unknown protocol: {protocol}" });

            return await useCase.ExecuteAsync(id, parsed, ct) switch
            {
                RemoveProtocolOutcome.Removed => Results.NoContent(),
                RemoveProtocolOutcome.NotFound => Results.NotFound(),
                RemoveProtocolOutcome.InUse => Results.Conflict(new { error = "protocol_in_use", message = $"A capability goes through {protocol}." }),
                var other => throw new InvalidOperationException($"Unhandled outcome {other}."),
            };
        });

        group.MapPut("/{id}/protocols/{protocol}", async (
            string id,
            string protocol,
            UpdateCameraProtocolRequest request,
            UpdateCameraProtocolUseCase useCase,
            CancellationToken ct) =>
        {
            if (!SnakeCaseEnum.TryFromSnakeCase<SupportedProtocol>(protocol, out var parsed))
                return Results.BadRequest(new { error = "unknown_protocol", message = $"Unknown protocol: {protocol}" });

            var result = await useCase.ExecuteAsync(id, parsed, request, ct);
            return result is null ? Results.NotFound() : Results.Ok(result);
        });

        group.MapPost("/{id}/protocols/{protocol}/check", async (
            string id,
            string protocol,
            CheckCameraProtocolUseCase useCase,
            CancellationToken ct) =>
        {
            if (!SnakeCaseEnum.TryFromSnakeCase<SupportedProtocol>(protocol, out var parsed))
                return Results.BadRequest(new { error = "unknown_protocol", message = $"Unknown protocol: {protocol}" });

            var result = await useCase.ExecuteAsync(id, parsed, ct);
            return result is null ? Results.NotFound() : Results.Ok(result);
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
