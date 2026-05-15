using Vyzio.Application.DTOs.DetectionEvents;
using Vyzio.Application.UseCases.DetectionEvents;
using Vyzio.Core.Entities;

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

        group.MapGet("/history", async (
            string? camera,
            string? label,
            string? profileId,
            DateTimeOffset? from,
            DateTimeOffset? to,
            int? page,
            int? limit,
            GetDetectionHistoryUseCase useCase,
            CancellationToken ct) =>
        {
            var query = new DetectionHistoryQuery(
                Camera: camera,
                Label: label,
                ProfileId: profileId,
                From: from,
                To: to,
                Page: page ?? 1,
                Limit: limit ?? 20);
            return Results.Ok(await useCase.ExecuteAsync(query, ct));
        });

        group.MapPatch("/{id}/identity", async (
            string id,
            CorrectDetectionIdentityRequest request,
            CorrectDetectionIdentityUseCase useCase,
            CancellationToken ct) =>
        {
            var updated = await useCase.ExecuteAsync(id, request, ct);
            return updated ? Results.NoContent() : Results.NotFound();
        });

        return app;
    }
}
