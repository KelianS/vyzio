using Vyzio.Application.DTOs.Cameras;
using Vyzio.Application.UseCases.Cameras;

namespace Vyzio.Api.Endpoints;

// The stream lines under a camera's stream binding (ADR-65); every answer carries the whole lineup.
public static class CameraStreamsEndpoints
{
    public static IEndpointRouteBuilder MapCameraStreams(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/cameras/{id}/streams");

        group.MapGet("", async (string id, GetCameraStreamsUseCase useCase, CancellationToken ct) =>
            await useCase.ExecuteAsync(id, ct) is { } streams ? Results.Ok(streams) : Results.NotFound());

        group.MapPost("", async (string id, AddCameraStreamRequest request, AddCameraStreamUseCase useCase, CancellationToken ct) =>
            ToResult(await useCase.ExecuteAsync(id, request, ct)));

        group.MapPut("/{streamId}/role", async (string id, string streamId, SetCameraStreamRoleRequest request, SetCameraStreamRoleUseCase useCase, CancellationToken ct) =>
            ToResult(await useCase.ExecuteAsync(id, streamId, request, ct)));

        group.MapPut("/{streamId}/enabled", async (string id, string streamId, SetCameraStreamEnabledRequest request, SetCameraStreamEnabledUseCase useCase, CancellationToken ct) =>
            ToResult(await useCase.ExecuteAsync(id, streamId, request, ct)));

        group.MapDelete("/{streamId}", async (string id, string streamId, RemoveCameraStreamUseCase useCase, CancellationToken ct) =>
            ToResult(await useCase.ExecuteAsync(id, streamId, ct)));

        group.MapPost("/{streamId}/check", async (string id, string streamId, CheckCameraStreamUseCase useCase, CancellationToken ct) =>
            ToResult(await useCase.ExecuteAsync(id, streamId, ct)));

        return app;
    }

    private static IResult ToResult(StreamResult result) => result.Outcome switch
    {
        StreamOutcome.Done => Results.Ok(result.Streams),
        StreamOutcome.CameraNotFound or StreamOutcome.StreamNotFound => Results.NotFound(),
        StreamOutcome.NotConfigured => Results.Conflict(new { error = "stream_not_configured", message = "The camera's stream protocol is not chosen yet." }),
        StreamOutcome.UnknownProtocol => Results.BadRequest(new { error = "unknown_protocol", message = "No stream provider speaks this protocol." }),
        StreamOutcome.UnknownRole => Results.BadRequest(new { error = "unknown_role", message = "Unknown stream role." }),
        StreamOutcome.ProtocolNotOnCamera => Results.Conflict(new { error = "protocol_not_on_camera", message = "The camera has no row for this protocol." }),
        StreamOutcome.StreamRecords => Results.Conflict(new { error = "stream_records", message = "This stream records: give recording to another stream first." }),
        StreamOutcome.StreamDisabled => Results.Conflict(new { error = "stream_disabled", message = "A disabled stream holds no role." }),
        _ => throw new InvalidOperationException($"Unhandled outcome {result.Outcome}."),
    };
}
