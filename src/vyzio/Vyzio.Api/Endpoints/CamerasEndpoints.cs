using Vyzio.Application.DTOs.Cameras;
using Vyzio.Application.UseCases.Cameras;

namespace Vyzio.Api.Endpoints;

public static class CamerasEndpoints
{
    public static IEndpointRouteBuilder MapCameras(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/cameras");

        group.MapPost("/discovery", async (DiscoverCamerasUseCase useCase, ILoggerFactory loggerFactory, CancellationToken ct) =>
        {
            var logger = loggerFactory.CreateLogger("CamerasDiscovery");
            logger.LogInformation("HTTP camera discovery request received.");

            var result = await useCase.ExecuteAsync(ct);

            logger.LogInformation("HTTP camera discovery request completed with {CandidateCount} candidate(s).", result.Count);
            return Results.Ok(result);
        });

        group.MapGet("/", async (GetCamerasUseCase useCase, CancellationToken ct) =>
            Results.Ok(await useCase.ExecuteAsync(ct)));

        group.MapPost("/", async (CreateCameraRequest request, CreateCameraUseCase useCase, CancellationToken ct) =>
        {
            var dto = await useCase.ExecuteAsync(request, ct);
            return Results.Created($"/api/cameras/{dto.Id}", dto);
        });

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

        group.MapDelete("/{id}", async (string id, DeleteCameraUseCase useCase, CancellationToken ct) =>
        {
            var result = await useCase.ExecuteAsync(id, ct);
            return result is null ? Results.NotFound() : Results.Ok(result);
        });

        return app;
    }
}