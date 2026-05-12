using Vyzio.Application.UseCases.Hub;

namespace Vyzio.Api.Endpoints;

public static class HubEndpoints
{
    public static IEndpointRouteBuilder MapHub(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/hub");

        group.MapGet("/overview", async (GetHubOverviewUseCase useCase, CancellationToken ct) =>
            Results.Ok(await useCase.ExecuteAsync(ct)));

        return app;
    }
}