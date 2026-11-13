using Vyzio.Application.DTOs.Cameras;
using Vyzio.Application.UseCases.Cameras;

namespace Vyzio.Api.Endpoints;

// The stream lines under a camera's stream binding (ADR-07); every change answers with the whole lineup.
public static class CameraStreamsEndpoints
{
    public static IEndpointRouteBuilder MapCameraStreams(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/cameras/{id}/streams");

        group.MapGet("", async (string id, GetCameraStreamsUseCase useCase, CancellationToken ct) =>
            await useCase.ExecuteAsync(id, ct) is { } streams ? Results.Ok(streams) : Results.NotFound());

        group.MapGet("/available", async (string id, string protocol, ListAvailableCameraStreamsUseCase useCase, CancellationToken ct) =>
        {
            var result = await useCase.ExecuteAsync(id, protocol, ct);
            return result.Outcome == StreamOutcome.Done ? Results.Ok(result.Streams) : ToError(result.Outcome);
        });

        group.MapPost("", async (string id, AddCameraStreamRequest request, AddCameraStreamUseCase useCase, CancellationToken ct) =>
            ToResult(await useCase.ExecuteAsync(id, request, ct)));

        group.MapPut("/{streamId}/role", async (string id, string streamId, SetCameraStreamRoleRequest request, SetCameraStreamRoleUseCase useCase, CancellationToken ct) =>
            ToResult(await useCase.ExecuteAsync(id, streamId, request, ct)));

        group.MapDelete("/{streamId}", async (string id, string streamId, RemoveCameraStreamUseCase useCase, CancellationToken ct) =>
            ToResult(await useCase.ExecuteAsync(id, streamId, ct)));

        group.MapPost("/{streamId}/check", async (string id, string streamId, CheckCameraStreamUseCase useCase, CancellationToken ct) =>
            ToResult(await useCase.ExecuteAsync(id, streamId, ct)));

        return app;
    }

    private static IResult ToResult(StreamResult result)
        => result.Outcome == StreamOutcome.Done ? Results.Ok(result.Streams) : ToError(result.Outcome);

    private static IResult ToError(StreamOutcome outcome) => outcome switch
    {
        StreamOutcome.CameraNotFound or StreamOutcome.StreamNotFound => Results.NotFound(),
        StreamOutcome.NotConfigured => ApiProblem.Conflict("stream_not_configured", "The camera's stream protocol is not chosen yet."),
        StreamOutcome.UnknownProtocol => ApiProblem.BadRequest("unknown_protocol", "No stream provider speaks this protocol."),
        StreamOutcome.UnknownRole => ApiProblem.BadRequest("unknown_role", "Unknown stream role."),
        StreamOutcome.ProtocolNotOnCamera => ApiProblem.Conflict("protocol_not_on_camera", "The camera has no row for this protocol."),
        StreamOutcome.StreamRecords => ApiProblem.Conflict("stream_records", "This stream records: give recording to another stream first."),
        StreamOutcome.PathRequired => ApiProblem.BadRequest("stream_path_required", "Over RTSP a stream is addressed by its path."),
        StreamOutcome.UnknownPath => ApiProblem.BadRequest("unknown_stream_path", "Over DVRIP a stream is one of its qualities, never a typed path."),
        _ => throw new InvalidOperationException($"Unhandled outcome {outcome}."),
    };
}
