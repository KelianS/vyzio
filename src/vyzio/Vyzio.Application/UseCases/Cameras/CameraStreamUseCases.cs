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
    StreamDisabled,
}

public sealed record StreamResult(StreamOutcome Outcome, CameraStreamsDto? Streams = null);

public sealed class GetCameraStreamsUseCase(ICameraRepository cameras)
{
    public async Task<CameraStreamsDto?> ExecuteAsync(string cameraId, CancellationToken ct = default)
        => await cameras.GetByIdAsync(cameraId, ct) is { } camera ? CameraStreamsDto.From(camera) : null;
}

// A stream the camera did not report, declared by hand and checked at once (ADR-65 e).
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
        var stream = StreamLineup.Add(binding, protocol, path, role);
        await StreamVerification.CheckStreamAsync(camera, stream, protocolCheck, verifier, run: null, ct);

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

public sealed class SetCameraStreamEnabledUseCase(ICameraRepository cameras, IFrigateConfigApplier frigateConfigApplier)
{
    public Task<StreamResult> ExecuteAsync(string cameraId, string streamId, SetCameraStreamEnabledRequest request, CancellationToken ct = default)
        => CameraStreamChange.ApplyAsync(cameras, frigateConfigApplier, cameraId, streamId,
            (_, stream) => StreamLineup.SetEnabled(stream, request.Enabled), ct);
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

        if (stream.Records)
        {
            await verifyCamera.ExecuteAsync(cameraId, ct: ct);
        }
        else
        {
            await StreamVerification.CheckStreamAsync(camera, stream, protocolCheck, verifier, run: null, ct);
            await cameras.UpdateAsync(camera, ct);
        }

        return new StreamResult(StreamOutcome.Done, CameraStreamsDto.From(camera));
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
            case StreamChange.StreamDisabled:
                return new StreamResult(StreamOutcome.StreamDisabled, CameraStreamsDto.From(camera));
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
