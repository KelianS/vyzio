using Vyzio.Application.DTOs.Cameras;
using Vyzio.Core.Common;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Cameras;

public enum StreamOutcome
{
    Done,
    CameraNotFound,
    StreamNotFound,
    // The camera has no stream binding yet: its protocol is chosen first (ADR-61).
    NotConfigured,
    UnknownProtocol,
    UnknownRole,
    ProtocolNotOnCamera,
    StreamRecords,
    UnknownPath,
    PathRequired,
}

public sealed record StreamResult(StreamOutcome Outcome, CameraStreamsDto? Streams = null);

public sealed record AvailableStreamsResult(StreamOutcome Outcome, IReadOnlyList<AvailableStreamDto>? Streams = null);

public sealed class GetCameraStreamsUseCase(ICameraRepository cameras)
{
    public async Task<CameraStreamsDto?> ExecuteAsync(string cameraId, CancellationToken ct = default)
        => await cameras.GetByIdAsync(cameraId, ct) is { } camera ? CameraStreamsDto.From(camera) : null;
}

// What the camera serves over a protocol, asked on demand once that protocol answers, binding or not (ADR-61 c, ADR-65 e).
public sealed class ListAvailableCameraStreamsUseCase(
    ICameraRepository cameras,
    ICapabilityProviderRegistry registry,
    CameraProtocolCheck protocolCheck,
    ICameraStreamEnumerator enumerator)
{
    public async Task<AvailableStreamsResult> ExecuteAsync(string cameraId, string protocolName, CancellationToken ct = default)
    {
        if (!SnakeCaseEnum.TryFromSnakeCase<SupportedProtocol>(protocolName, out var protocol)
            || !registry.GetRegisteredProtocols(CameraCapability.Stream).Contains(protocol))
            return new AvailableStreamsResult(StreamOutcome.UnknownProtocol);

        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null) return new AvailableStreamsResult(StreamOutcome.CameraNotFound);
        if (camera.Protocol(protocol) is null) return new AvailableStreamsResult(StreamOutcome.ProtocolNotOnCamera);

        var answer = await protocolCheck.CheckAsync(camera, protocol, run: null, ct);
        await cameras.UpdateAsync(camera, ct);
        var scenes = answer.Status == ProtocolStatus.Answers ? await enumerator.EnumerateAsync(camera, protocol, ct) : [];
        // Only this camera's scene (ADR-38); over DVRIP the two qualities are known by convention when it lists none.
        var found = scenes.Count > 0 ? scenes[0].Streams : protocol == SupportedProtocol.Dvrip ? DvripQualities : [];
        return new AvailableStreamsResult(StreamOutcome.Done,
            [.. StreamLineup.Offer(camera.StreamBinding, protocol, found).Select(AvailableStreamDto.From)]);
    }

    private static readonly IReadOnlyList<EnumeratedStream> DvripQualities =
        [new(null, null, null, null), new(CameraStream.DvripSecondaryQuery, null, null, null)];
}

// A stream the user adds, picked from what the camera serves or typed over RTSP, checked at once (ADR-65 e).
public sealed class AddCameraStreamUseCase(
    ICameraRepository cameras,
    ICapabilityProviderRegistry registry,
    CameraProtocolCheck protocolCheck,
    ICameraVerifier verifier,
    IFrigateConfigApplier frigateConfigApplier)
{
    public async Task<StreamResult> ExecuteAsync(string cameraId, AddCameraStreamRequest request, CancellationToken ct = default)
    {
        if (!SnakeCaseEnum.TryFromSnakeCase<SupportedProtocol>(request.Protocol, out var protocol)
            || !registry.GetRegisteredProtocols(CameraCapability.Stream).Contains(protocol))
            return new StreamResult(StreamOutcome.UnknownProtocol);
        if (!SnakeCaseEnum.TryFromSnakeCase<StreamRole>(request.Role, out var role))
            return new StreamResult(StreamOutcome.UnknownRole);

        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null) return new StreamResult(StreamOutcome.CameraNotFound);
        if (camera.StreamBinding is not { } binding) return new StreamResult(StreamOutcome.NotConfigured);
        // Like any capability, a stream goes through one of the camera's own protocol rows (ADR-61 d).
        if (camera.Protocol(protocol) is null) return new StreamResult(StreamOutcome.ProtocolNotOnCamera);

        var path = protocol == SupportedProtocol.Rtsp
            ? CameraDraftFactory.NormalizeStreamPath(request.Path)
            : CameraDraftFactory.NormalizeOptional(request.Path);
        // An RTSP stream is addressed by its path, never by the connection root (ADR-65 e).
        if (protocol == SupportedProtocol.Rtsp && path is null)
            return new StreamResult(StreamOutcome.PathRequired);
        if (protocol == SupportedProtocol.Dvrip && path is not (null or CameraStream.DvripSecondaryQuery))
            return new StreamResult(StreamOutcome.UnknownPath);
        var stream = StreamLineup.Add(binding, protocol, path, role);
        await StreamVerification.CheckStreamAsync(camera, stream, protocolCheck, verifier, run: null, ct);

        camera.UpdatedAt = DateTimeOffset.UtcNow;
        await cameras.UpdateAsync(camera, ct);
        if (role != StreamRole.None) await SurveillanceConfig.WriteAsync(cameras, frigateConfigApplier, ct);
        return new StreamResult(StreamOutcome.Done, CameraStreamsDto.From(camera));
    }
}

public sealed class SetCameraStreamRoleUseCase(ICameraRepository cameras, IFrigateConfigApplier frigateConfigApplier)
{
    public async Task<StreamResult> ExecuteAsync(string cameraId, string streamId, SetCameraStreamRoleRequest request, CancellationToken ct = default)
    {
        if (!SnakeCaseEnum.TryFromSnakeCase<StreamRole>(request.Role, out var role))
            return new StreamResult(StreamOutcome.UnknownRole);

        return await CameraStreamChange.ApplyAsync(cameras, frigateConfigApplier, cameraId, streamId,
            (binding, stream) => StreamLineup.SetRole(binding, stream, role), ct);
    }
}

public sealed class RemoveCameraStreamUseCase(ICameraRepository cameras, IFrigateConfigApplier frigateConfigApplier)
{
    public Task<StreamResult> ExecuteAsync(string cameraId, string streamId, CancellationToken ct = default)
        => CameraStreamChange.ApplyAsync(cameras, frigateConfigApplier, cameraId, streamId, StreamLineup.Remove, ct);
}

// One stream checked alone; the recording stream's check is the camera's, so it runs the whole verification (ADR-65 f).
public sealed class CheckCameraStreamUseCase(
    ICameraRepository cameras,
    VerifyCameraUseCase verifyCamera,
    CameraProtocolCheck protocolCheck,
    ICameraVerifier verifier)
{
    public async Task<StreamResult> ExecuteAsync(string cameraId, string streamId, CancellationToken ct = default)
    {
        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null) return new StreamResult(StreamOutcome.CameraNotFound);
        if (camera.Streams.FirstOrDefault(entry => entry.Id == streamId) is not { } stream)
            return new StreamResult(StreamOutcome.StreamNotFound);

        if (!stream.Records)
        {
            await StreamVerification.CheckStreamAsync(camera, stream, protocolCheck, verifier, run: null, ct);
            await cameras.UpdateAsync(camera, ct);
            return new StreamResult(StreamOutcome.Done, CameraStreamsDto.From(camera));
        }

        await verifyCamera.ExecuteAsync(cameraId, ct: ct);
        var verified = await cameras.GetByIdAsync(cameraId, ct);
        return verified is null
            ? new StreamResult(StreamOutcome.CameraNotFound)
            : new StreamResult(StreamOutcome.Done, CameraStreamsDto.From(verified));
    }
}

// Over RTSP the camera listed no stream, or could not be asked, and no path was typed (ADR-65 e).
public sealed class StreamPathRequiredException()
    : Exception("The camera listed no stream over RTSP, or could not be asked: type the stream's path.");

// Lays the streams out over a newly chosen stream protocol; an RTSP stream always has a path (ADR-65 e).
internal static class StreamLayout
{
    // False when nothing could be laid out: over RTSP, no typed path and no stream listed.
    public static async Task<bool> TryLayOutAsync(
        Camera camera,
        CameraCapabilityBinding binding,
        SupportedProtocol protocol,
        string? typedPath,
        ICameraStreamEnumerator enumerator,
        TimeProvider time,
        CancellationToken ct)
    {
        if (protocol != SupportedProtocol.Rtsp)
        {
            StreamLineup.ResetTo(binding, protocol, path: null);
            return true;
        }

        if (CameraDraftFactory.NormalizeStreamPath(typedPath) is { } path)
        {
            StreamLineup.ResetTo(binding, protocol, path);
            return true;
        }

        var scenes = await enumerator.EnumerateAsync(camera, protocol, ct);
        // Only this camera's scene: other lenses become cameras of their own through onboarding (ADR-38).
        if (scenes.Count == 0 || scenes[0].Streams.Count == 0) return false;

        StreamLineup.ResetToFound(binding, protocol, scenes[0].Streams, time.GetUtcNow());
        return true;
    }
}

internal static class CameraStreamChange
{
    // Applies one lineup change, then rewrites what Frigate reads: the roles or the streams changed (ADR-65 g).
    public static async Task<StreamResult> ApplyAsync(
        ICameraRepository cameras,
        IFrigateConfigApplier frigateConfigApplier,
        string cameraId,
        string streamId,
        Func<CameraCapabilityBinding, CameraStream, StreamChange> change,
        CancellationToken ct)
    {
        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null) return new StreamResult(StreamOutcome.CameraNotFound);
        if (camera.StreamBinding is not { } binding
            || binding.Streams.FirstOrDefault(entry => entry.Id == streamId) is not { } stream)
            return new StreamResult(StreamOutcome.StreamNotFound);

        switch (change(binding, stream))
        {
            case StreamChange.StreamRecords:
                return new StreamResult(StreamOutcome.StreamRecords, CameraStreamsDto.From(camera));
            case StreamChange.Done:
                break;
            default:
                throw new InvalidOperationException("Unhandled stream change.");
        }

        camera.UpdatedAt = DateTimeOffset.UtcNow;
        await cameras.UpdateAsync(camera, ct);
        await SurveillanceConfig.WriteAsync(cameras, frigateConfigApplier, ct);
        return new StreamResult(StreamOutcome.Done, CameraStreamsDto.From(camera));
    }
}
