using Microsoft.AspNetCore.StaticFiles;
using Vyzio.Application.DTOs.Cameras;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Infrastructure.Configuration;

namespace Vyzio.Api.Endpoints;

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