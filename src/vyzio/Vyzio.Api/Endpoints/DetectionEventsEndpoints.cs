using Vyzio.Application.DTOs.DetectionEvents;
using Vyzio.Application.UseCases.DetectionEvents;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

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
            string? cursor,
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
                Cursor: cursor,
                Limit: limit ?? 20);
            return Results.Ok(await useCase.ExecuteAsync(query, ct));
        });

        // Clip proxy — streams MP4 from Frigate with Range support (ADR-17)
        group.MapGet("/{id}/clip", async (string id, IFrigateClipProvider clips, CancellationToken ct) =>
        {
            var stream = await clips.TryGetClipAsync(id, ct);
            if (stream is null) return Results.NotFound();
            return Results.Stream(stream, "video/mp4", enableRangeProcessing: true);
        });

        // Snapshot proxy — serves JPEG from Frigate (ADR-17), avoids CORS from browser direct access
        group.MapGet("/{id}/snapshot", async (string id, IFrigateSnapshotProvider snapshots, CancellationToken ct) =>
        {
            var stream = await snapshots.TryGetSnapshotAsync(id, ct);
            if (stream is null) return Results.NotFound();

            return Results.Stream(stream, "image/jpeg");
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
