using Vyzio.Application.UseCases.Monitoring;

namespace Vyzio.Api.Endpoints;

public static class SystemEndpoints
{
    public static IEndpointRouteBuilder MapSystem(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/system/stats", async (GetSystemStatsUseCase useCase, CancellationToken ct) =>
            Results.Ok(await useCase.ExecuteAsync(ct)));

        return app;
    }
}
