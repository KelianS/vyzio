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

        // Clip proxy — streams MP4 from Frigate with Range support (ADR-12)
        group.MapGet("/{id}/clip", async (string id, IFrigateClipProvider clips, CancellationToken ct) =>
        {
            // An id Frigate could never have issued names no clip, and reaches neither Frigate nor a log.
            if (!FrigateEventId.IsWellFormed(id)) return Results.NotFound();
            var stream = await clips.ReadClipAsync(id, ct);
            if (stream is null) return Results.NotFound();
            return Results.Stream(stream, "video/mp4", enableRangeProcessing: true);
        });

        // Image proxies — serve JPEG from Frigate (ADR-12), avoid CORS from browser direct access.
        // Two routes because they are two images: the full frame situates, the thumbnail is the crop.
        group.MapGet("/{id}/snapshot", (string id, IFrigateEventImageProvider images, CancellationToken ct) =>
            StreamImageAsync(id, FrigateEventImage.Snapshot, images, ct));

        group.MapGet("/{id}/thumbnail", (string id, IFrigateEventImageProvider images, CancellationToken ct) =>
            StreamImageAsync(id, FrigateEventImage.Thumbnail, images, ct));

        group.MapPatch("/{id}/identity", async (
            string id,
            CorrectDetectionIdentityRequest request,
            CorrectDetectionIdentityUseCase useCase,
            CancellationToken ct) =>
        {
            var updated = await useCase.ExecuteAsync(id, request, ct);
            return updated ? Results.NoContent() : Results.NotFound();
        });

        group.MapDelete("/{id}", async (string id, DeleteDetectionUseCase useCase, CancellationToken ct) =>
            !FrigateEventId.IsWellFormed(id)
                ? ApiProblem.NotFound("detection_not_found", "No detection has that id.")
                : await useCase.ExecuteAsync(id, ct) switch
                {
                    DetectionErasure.Erased => Results.NoContent(),
                    DetectionErasure.NotFound => ApiProblem.NotFound("detection_not_found", $"No detection {id} to erase."),
                    DetectionErasure.InProgress => ApiProblem.Conflict(
                        "detection_in_progress", $"Detection {id} is still being filmed; nothing was erased."),
                    _ => throw new InvalidOperationException($"Unhandled erasure outcome for {id}."),
                });

        return app;
    }

    private static async Task<IResult> StreamImageAsync(
        string id, FrigateEventImage image, IFrigateEventImageProvider images, CancellationToken ct)
    {
        var stream = await images.TryGetImageAsync(id, image, ct: ct);
        return stream is null ? Results.NotFound() : Results.Stream(stream, "image/jpeg");
    }
}
