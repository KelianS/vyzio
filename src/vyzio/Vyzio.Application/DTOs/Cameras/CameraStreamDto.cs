using Vyzio.Core.Common;
using Vyzio.Core.Entities;

namespace Vyzio.Application.DTOs.Cameras;

// One stream line (ADR-65): the camera's own facts (rank, measured size), its role and its last check.
public sealed record CameraStreamDto(
    string Id,
    int Ordinal,
    string Protocol,
    string? Path,
    int? Width,
    int? Height,
    int? Fps,
    string Role,
    bool Verified,
    DateTimeOffset? CheckedAt,
    string? LastError)
{
    public static CameraStreamDto From(CameraStream stream) => new(
        stream.Id,
        stream.Ordinal,
        SnakeCaseEnum.ToSnakeCase(stream.Protocol),
        stream.Path,
        stream.Width,
        stream.Height,
        stream.Fps,
        SnakeCaseEnum.ToSnakeCase(stream.Role),
        stream.Verified,
        stream.CheckedAt,
        stream.LastError);
}

// The whole lineup, since a role given to one stream is taken from another; the effective roles are resolved in Core.
public sealed record CameraStreamsDto(
    IReadOnlyList<CameraStreamDto> Streams,
    string? RecordStreamId,
    string? DetectStreamId,
    bool DetectsOnRecordingStream)
{
    public static CameraStreamsDto From(Camera camera) => new(
        [.. camera.Streams.Select(CameraStreamDto.From)],
        camera.RecordStream?.Id,
        camera.DetectStream?.Id,
        camera.DetectsOnRecordingStream);
}

// Path: over RTSP any path; over DVRIP only one of the offered qualities, never a typed query (ADR-38).
public sealed record AddCameraStreamRequest(string Protocol, string? Path, string Role);

public sealed record SetCameraStreamRoleRequest(string Role);

// A stream the camera serves, read by quality; StreamId is the line it already is, null when it is not listed (ADR-65 e).
public sealed record AvailableStreamDto(int Rank, string? Path, int? Width, int? Height, int? Fps, string? StreamId)
{
    public static AvailableStreamDto From(StreamOffer offer)
        => new(offer.Rank, offer.Path, offer.Width, offer.Height, offer.Fps, offer.StreamId);
}
