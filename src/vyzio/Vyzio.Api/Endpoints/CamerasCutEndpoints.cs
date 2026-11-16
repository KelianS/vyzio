using Vyzio.Application.DTOs.Scheduling;
using Vyzio.Application.UseCases.Cameras;

namespace Vyzio.Api.Endpoints;

// The cut of every camera from the home, until a chosen end or until resumed (PRIV-22); resuming them all is the batch toggle.
public static class CamerasCutEndpoints
{
    public static IEndpointRouteBuilder MapCamerasCut(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/cameras/privacy/cut");

        group.MapGet("", async (GetCamerasCutUseCase useCase, CancellationToken ct) =>
            Results.Ok(await useCase.ExecuteAsync(ct)));

        group.MapPut("", async (ChosenEndRequest request, CutCamerasUseCase useCase, CancellationToken ct) =>
        {
            var result = await useCase.ExecuteAsync(request, ct);
            return result.Refusal is { } refusal ? ChosenEndProblem.Of("cut", refusal) : Results.Ok(result.Cameras);
        });

        return app;
    }
}
