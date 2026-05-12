using Vyzio.Application.UseCases.DetectionEvents;

namespace Vyzio.Api.Endpoints;

public static class DetectionEventsEndpoints
{
    public static IEndpointRouteBuilder MapDetectionEvents(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/detection-events");

        group.MapGet("/recent", async (int? limit, GetRecentDetectionEventsUseCase useCase, CancellationToken ct) =>
            Results.Ok(await useCase.ExecuteAsync(limit ?? 20, ct)));

        group.MapGet("/profiles/{profileId}", async (string profileId, int? limit, GetProfileDetectionEventsUseCase useCase, CancellationToken ct) =>
            Results.Ok(await useCase.ExecuteAsync(profileId, limit ?? 20, ct)));

        return app;
    }
}