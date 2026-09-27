using Vyzio.Core.Common;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Cameras;

public sealed record CameraProtocolDto(
    string Protocol,
    int? Port,
    int? EffectivePort,
    string? Username,
    bool HasSpecificAccount,
    uint? DeviceId,
    string? Status,
    DateTimeOffset? CheckedAt,
    string? LastError)
{
    public static CameraProtocolDto From(CameraProtocol entry) => new(
        SnakeCaseEnum.ToSnakeCase(entry.Protocol),
        entry.Port,
        // ONVIF has no usual port: the one the camera answered on is read from its address (ADR-56).
        entry.EffectivePort ?? PortOfEndpoint(entry.Endpoint),
        entry.Username,
        entry.HasSpecificAccount,
        entry.DeviceId,
        entry.Status is { } status ? SnakeCaseEnum.ToSnakeCase(status) : null,
        entry.CheckedAt,
        entry.LastError);

    private static int? PortOfEndpoint(string? endpoint)
        => Uri.TryCreate(endpoint, UriKind.Absolute, out var uri) ? uri.Port : null;
}

// The answers already heard during one gesture: a protocol is asked once, however many capabilities name it (ADR-61).
public sealed class ProtocolCheckRun
{
    internal HashSet<SupportedProtocol> Checked { get; } = [];
}

// The protocol level's check: reach, then login with the protocol's account, recorded on its row (ADR-61).
public sealed class CameraProtocolCheck(ICameraProtocolProbe probe, TimeProvider time)
{
    // Writes on the entity only; the caller owning the transaction saves the camera.
    public async Task<CameraProtocol> CheckAsync(Camera camera, SupportedProtocol protocol, ProtocolCheckRun? run, CancellationToken ct)
    {
        var entry = camera.EnsureProtocol(protocol);
        if (run is not null && !run.Checked.Add(protocol)) return entry;

        var answer = await probe.ProbeAsync(camera, protocol, ct);
        entry.Status = answer.Status;
        entry.CheckedAt = time.GetUtcNow();
        entry.LastError = answer.Status == ProtocolStatus.Answers ? null : answer.Error;
        entry.UpdatedAt = entry.CheckedAt.Value;
        return entry;
    }
}

public sealed class GetCameraProtocolsUseCase(ICameraRepository cameras)
{
    public async Task<IReadOnlyList<CameraProtocolDto>?> ExecuteAsync(string cameraId, CancellationToken ct = default)
    {
        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null) return null;

        // The stream's protocol first: the one every other capability depends on.
        var streamProtocol = camera.StreamBinding?.Protocol;
        return camera.Protocols
            .OrderByDescending(entry => entry.Protocol == streamProtocol)
            .ThenBy(entry => entry.Protocol)
            .Select(CameraProtocolDto.From)
            .ToList();
    }
}

// The user's "does it answer?" on one protocol: it goes through no capability, so a failing stream never suspends it.
public sealed class CheckCameraProtocolUseCase(ICameraRepository cameras, CameraProtocolCheck protocolCheck)
{
    public async Task<CameraProtocolDto?> ExecuteAsync(string cameraId, SupportedProtocol protocol, CancellationToken ct = default)
    {
        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null) return null;

        var entry = await protocolCheck.CheckAsync(camera, protocol, run: null, ct);
        await cameras.UpdateAsync(camera, ct);
        return CameraProtocolDto.From(entry);
    }
}

// The whole box as the screen holds it: a null password keeps the saved one, an empty user name drops the specific account.
public sealed record UpdateCameraProtocolRequest(int? Port, string? Username, string? Password, uint? DeviceId);

public sealed class UpdateCameraProtocolUseCase(
    ICameraRepository cameras,
    ICameraProtocolEndpointCache endpointCache,
    IFrigateConfigApplier frigateConfigApplier,
    TimeProvider time)
{
    public async Task<CameraProtocolDto?> ExecuteAsync(
        string cameraId, SupportedProtocol protocol, UpdateCameraProtocolRequest request, CancellationToken ct = default)
    {
        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null) return null;

        var entry = camera.EnsureProtocol(protocol);
        // The usual port is stored as none, so a later change of the usual one reaches this camera.
        var port = request.Port is > 0 && request.Port != ProtocolPorts.Usual(protocol) ? request.Port : null;
        var username = CameraDraftFactory.NormalizeOptional(request.Username);
        var password = username is null
            ? null
            : request.Password is null ? entry.Password : CameraDraftFactory.NormalizeOptional(request.Password);

        var reachChanged = entry.Port != port
            || !string.Equals(entry.Username, username, StringComparison.Ordinal)
            || !string.Equals(entry.Password, password, StringComparison.Ordinal);
        var changed = reachChanged || entry.DeviceId != request.DeviceId;
        if (!changed) return CameraProtocolDto.From(entry);

        // A port set by hand is where the camera is asked again, never a remembered address (ADR-56).
        if (protocol == SupportedProtocol.Onvif && entry.Port != port)
            CameraEndpointForgetting.Forget(camera, endpointCache);

        entry.Port = port;
        entry.Username = username;
        entry.Password = password;
        entry.DeviceId = request.DeviceId;
        entry.Status = null;
        entry.CheckedAt = null;
        entry.LastError = null;
        entry.UpdatedAt = time.GetUtcNow();

        var streamChanged = reachChanged && camera.Capabilities.Any(b => b.Capability == CameraCapability.Stream && b.Protocol == protocol);
        if (streamChanged) CameraConnectionChange.Apply(camera);

        await cameras.UpdateAsync(camera, ct);
        if (streamChanged) await SurveillanceConfig.WriteAsync(cameras, frigateConfigApplier, ct);

        return CameraProtocolDto.From(entry);
    }
}

// A protocol the camera did not have: its port (null: the usual one) and an optional specific account.
public sealed record AddCameraProtocolRequest(string Protocol, int? Port, string? Username, string? Password);

public enum AddProtocolOutcome
{
    Added,
    CameraNotFound,
    UnknownProtocol,
    AlreadySpoken,
}

public sealed record AddProtocolResult(AddProtocolOutcome Outcome, CameraProtocolDto? Protocol = null);

// Adds a protocol once the camera exists and checks it at once, reach then login (ADR-61).
public sealed class AddCameraProtocolUseCase(ICameraRepository cameras, CameraProtocolCheck protocolCheck, TimeProvider time)
{
    public async Task<AddProtocolResult> ExecuteAsync(string cameraId, AddCameraProtocolRequest request, CancellationToken ct = default)
    {
        if (!SnakeCaseEnum.TryFromSnakeCase<SupportedProtocol>(request.Protocol, out var protocol))
            return new AddProtocolResult(AddProtocolOutcome.UnknownProtocol);

        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null) return new AddProtocolResult(AddProtocolOutcome.CameraNotFound);
        if (camera.Protocol(protocol) is not null) return new AddProtocolResult(AddProtocolOutcome.AlreadySpoken);

        var entry = camera.EnsureProtocol(protocol);
        // The usual port is stored as none, as on any other row.
        entry.Port = request.Port is > 0 && request.Port != ProtocolPorts.Usual(protocol) ? request.Port : null;
        entry.Username = CameraDraftFactory.NormalizeOptional(request.Username);
        entry.Password = entry.Username is null ? null : CameraDraftFactory.NormalizeOptional(request.Password);
        entry.UpdatedAt = time.GetUtcNow();

        await protocolCheck.CheckAsync(camera, protocol, run: null, ct);
        await cameras.UpdateAsync(camera, ct);
        return new AddProtocolResult(AddProtocolOutcome.Added, CameraProtocolDto.From(entry));
    }
}

public enum RemoveProtocolOutcome
{
    Removed,
    NotFound,
    InUse,
}

// Removes a protocol no capability goes through, however many streams or capabilities a camera has (ADR-61).
public sealed class RemoveCameraProtocolUseCase(ICameraRepository cameras, ICameraProtocolEndpointCache endpointCache)
{
    public async Task<RemoveProtocolOutcome> ExecuteAsync(string cameraId, SupportedProtocol protocol, CancellationToken ct = default)
    {
        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera?.Protocol(protocol) is not { } entry) return RemoveProtocolOutcome.NotFound;

        if (camera.Capabilities.Any(b => b.Protocol == protocol)) return RemoveProtocolOutcome.InUse;

        // Removing ONVIF drops both halves of where it answered (ADR-56).
        if (protocol == SupportedProtocol.Onvif) endpointCache.Forget(camera.Id);
        camera.Protocols.Remove(entry);
        await cameras.UpdateAsync(camera, ct);
        return RemoveProtocolOutcome.Removed;
    }
}

// The stream capability's main path, a setting of the stream over RTSP (ADR-38, ADR-61).
public sealed class SetStreamPathUseCase(
    ICameraRepository cameras,
    ICameraCapabilityBindingRepository bindings,
    IFrigateConfigApplier frigateConfigApplier)
{
    public async Task<CameraCapabilityBindingDto?> ExecuteAsync(string cameraId, string? path, CancellationToken ct = default)
    {
        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null) return null;

        var normalized = CameraDraftFactory.NormalizeStreamPath(path);
        if (camera.MainStream?.Path != normalized)
        {
            camera.SetMainStreamPath(normalized);
            CameraConnectionChange.Apply(camera);
            await cameras.UpdateAsync(camera, ct);
            await SurveillanceConfig.WriteAsync(cameras, frigateConfigApplier, ct);
        }

        var binding = await bindings.GetAsync(cameraId, CameraCapability.Stream, ct);
        return binding is null ? null : CameraCapabilityBindingDto.From(binding, camera);
    }
}

// A new way to reach the stream: the camera is checked again before surveillance takes it up (ADR-44, ADR-61).
internal static class CameraConnectionChange
{
    public static void Apply(Camera camera)
    {
        camera.Status = "needs_attention";
        camera.ValidationState = CameraValidationState.Draft;
        camera.IsEnabled = false;
        camera.LastReachabilityCheckAt = null;
        camera.LastSuccessfulFrameAt = null;
        camera.UpdatedAt = DateTimeOffset.UtcNow;
    }
}

// Writes the configuration of every camera surveillance can take up, without applying it (ADR-44).
internal static class SurveillanceConfig
{
    public static async Task WriteAsync(ICameraRepository cameras, IFrigateConfigApplier frigateConfigApplier, CancellationToken ct)
    {
        var applicable = (await cameras.GetAllAsync(ct))
            .Where(c => c.IsEnabled && c.ValidationState == CameraValidationState.Validated)
            .ToList();
        await frigateConfigApplier.WriteConfigAsync(applicable, changed: true, ct);
    }
}
