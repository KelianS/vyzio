using Vyzio.Core.Common;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Cameras;

// One detection for every camera, whatever its vendor: the protocols once, then each capability over those that answer (ADR-61, ADR-71 b).
public sealed class DetectCameraCapabilitiesUseCase(
    ICameraRepository cameras,
    ICameraCapabilityBindingRepository bindings,
    ProbeCameraCapabilityUseCase probe,
    ICapabilityProviderRegistry registry,
    ICameraProtocolEndpointCache endpointCache,
    DetectionPlan detectionPlan,
    CameraProtocolSearch protocolSearch,
    IFrigateConfigApplier frigateConfigApplier,
    ICameraStreamEnumerator streamEnumerator,
    TimeProvider time)
{
    public async Task ExecuteAsync(string cameraId, CancellationToken ct = default)
    {
        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null) return;

        // "Look at this camera again": forget once for the whole cascade, not per candidate (ADR-56).
        CameraEndpointForgetting.Forget(camera, endpointCache);

        // Both levels in order: the protocols first, then the capabilities over those that answer (ADR-61 d).
        var run = new ProtocolCheckRun();
        await protocolSearch.RunAsync(camera, run, ct);
        await cameras.UpdateAsync(camera, ct);

        // A camera without a stream reads "to configure": detection binds it, never moves it (ADR-61 b).
        if (await bindings.GetAsync(cameraId, CameraCapability.Stream, ct) is null)
            await BindStreamAsync(cameraId, registry.GetRegisteredProtocols(CameraCapability.Stream), run, ct);

        foreach (var (capability, protocols) in detectionPlan.Steps())
            await DetectCapabilityAsync(cameraId, capability, protocols, run, ct);

        await DropSilentTriesAsync(cameraId, ct);

        // Once detected, the page no longer runs detection on arrival (ADR-68 b).
        if (await cameras.GetByIdAsync(cameraId, ct) is { } detected)
        {
            detected.DetectedAt = time.GetUtcNow();
            await cameras.UpdateAsync(detected, ct);
        }
    }

    private static bool Answers(Camera camera, SupportedProtocol protocol) => camera.Protocol(protocol)?.Answers == true;

    private static bool OutrankedByAnAnswer(Camera? camera, IReadOnlyList<SupportedProtocol> protocols, SupportedProtocol current)
        => camera is not null && protocols.TakeWhile(protocol => protocol != current).Any(protocol => Answers(camera, protocol));

    private async Task DetectCapabilityAsync(
        string cameraId,
        CameraCapability capability,
        IReadOnlyList<SupportedProtocol> protocols,
        ProtocolCheckRun run,
        CancellationToken ct)
    {
        var camera = await cameras.GetByIdAsync(cameraId, ct);
        var existing = await bindings.GetAsync(cameraId, capability, ct);

        // A manual override (ADR-28) is never touched by re-running detection, whether it
        // currently works or not — the user's choice stands until they change it themselves.
        if (existing is { ManuallyConfigured: true })
        {
            await probe.ExecuteAsync(cameraId, capability, ct: ct, run: run);
            return;
        }

        // Confirmed by the user, or proven with no higher-priority candidate answering now: only checked again (ADR-66 c, ADR-71 b).
        if (existing is not null && protocols.Contains(existing.Protocol)
            && (existing.ConfirmedAt is not null || (existing.Verified && !OutrankedByAnAnswer(camera, protocols, existing.Protocol))))
        {
            await probe.ExecuteAsync(cameraId, capability, ct: ct, run: run);
            return;
        }

        // Only the candidates that answered, in priority order; with none, the first one says why (ADR-61).
        var answering = protocols.Where(protocol => camera is not null && Answers(camera, protocol)).ToList();
        var candidates = answering.Count > 0 ? answering : [protocols[0]];

        if (existing is { RejectedAt: { } rejectedAt } && protocols.Contains(existing.Protocol))
        {
            await KeepTheUsersNoAsync(existing, rejectedAt, candidates, run, ct);
            return;
        }

        // In priority order, the first candidate that proves it or leaves it to confirm wins (ADR-71 b).
        CameraCapabilityBindingDto? result = null;
        foreach (var protocol in candidates)
        {
            (existing, result) = await TryCapabilityAsync(cameraId, capability, existing, protocol, run, ct);
            if (result?.Verified == true || IsToConfirm(result)) break;
        }

        // A capability its protocol answered for stays to confirm; one no candidate shows is not worth a card (ADR-71 c).
        if (result?.Verified != true && !IsToConfirm(result))
            await bindings.DeleteAsync(cameraId, capability, ct);
    }

    // Only a proof, on any candidate, replaces the user's "no"; a mere "to confirm" never asks again (ADR-66 e).
    private async Task KeepTheUsersNoAsync(
        CameraCapabilityBinding rejected,
        DateTimeOffset rejectedAt,
        IReadOnlyList<SupportedProtocol> candidates,
        ProtocolCheckRun run,
        CancellationToken ct)
    {
        var rejectedOn = rejected.Protocol;
        var proven = false;
        try
        {
            foreach (var protocol in candidates.Where(protocol => protocol != rejectedOn))
            {
                var (_, result) = await TryCapabilityAsync(rejected.CameraId, rejected.Capability, rejected, protocol, run, ct);
                proven = result?.Verified == true;
                if (proven) return;
            }
        }
        finally
        {
            // Back on its protocol with the "no", even when the detection stops halfway.
            if (!proven && rejected.Protocol != rejectedOn)
            {
                CapabilityVerdict.Reset(rejected, rejectedOn);
                rejected.RejectedAt = rejectedAt;
                await bindings.SaveAsync(rejected, CancellationToken.None);
            }
        }

        // Its own protocol is checked last: a proof there promotes it, anything else keeps the "no".
        await probe.ExecuteAsync(rejected.CameraId, rejected.Capability, ct: ct, run: run);
    }

    private async Task<(CameraCapabilityBinding, CameraCapabilityBindingDto?)> TryCapabilityAsync(
        string cameraId,
        CameraCapability capability,
        CameraCapabilityBinding? existing,
        SupportedProtocol protocol,
        ProtocolCheckRun run,
        CancellationToken ct)
    {
        var binding = existing ?? new CameraCapabilityBinding { CameraId = cameraId, Capability = capability, Protocol = protocol };
        CapabilityVerdict.Reset(binding, protocol);
        await bindings.SaveAsync(binding, ct);
        return (binding, await probe.ExecuteAsync(cameraId, capability, ct: ct, run: run));
    }

    private static bool IsToConfirm(CameraCapabilityBindingDto? result)
        => result is not null
            && SnakeCaseEnum.TryFromSnakeCase<CapabilityStatus>(result.Status, out var status)
            && status == CapabilityStatus.ToConfirm;

    // The first stream protocol that answers and whose stream check passes, in the registry's order (ADR-61 b).
    private async Task BindStreamAsync(string cameraId, IReadOnlyList<SupportedProtocol> candidates, ProtocolCheckRun run, CancellationToken ct)
    {
        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null) return;

        var answering = candidates.Where(protocol => Answers(camera, protocol)).ToList();
        if (answering.Count == 0) return;

        var binding = new CameraCapabilityBinding { CameraId = cameraId, Capability = CameraCapability.Stream };
        var verified = false;
        SupportedProtocol? fallback = null;
        SupportedProtocol? lastTried = null;
        foreach (var protocol in answering)
        {
            var tried = await TryStreamAsync(camera, binding, protocol, run, ct);
            if (tried is null) continue;
            verified = tried.Value;
            if (verified) break;
            fallback ??= protocol;
            lastTried = protocol;
        }

        // With no stream check passing, the stream stays on the first protocol it was laid out on, with its reason.
        if (!verified && fallback is { } first && first != lastTried)
            await TryStreamAsync(camera, binding, first, run, ct);

        await SurveillanceConfig.WriteAsync(camera, cameras, frigateConfigApplier, ct);
    }

    // Null when no stream could be laid out over the protocol: RTSP is only bound with the streams the camera lists (ADR-65 e).
    private async Task<bool?> TryStreamAsync(Camera camera, CameraCapabilityBinding binding, SupportedProtocol protocol, ProtocolCheckRun run, CancellationToken ct)
    {
        if (!await StreamLayout.TryLayOutAsync(camera, binding, protocol, typedPath: null, streamEnumerator, time, ct)) return null;

        // A stream bound is a connection change, like a stream protocol chosen by the user.
        CameraConnectionChange.Apply(camera);
        await cameras.UpdateAsync(camera, ct);

        CapabilityVerdict.Reset(binding, protocol);
        await bindings.SaveAsync(binding, ct);

        var result = await probe.ExecuteAsync(binding.CameraId, CameraCapability.Stream, run: run, ct: ct);
        return result?.Verified == true;
    }

    // The rows list what the camera speaks, not what Vyzio tried (ADR-61).
    private async Task DropSilentTriesAsync(string cameraId, CancellationToken ct)
    {
        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null) return;

        var silent = camera.Protocols
            .Where(entry => entry.Status == ProtocolStatus.Unreachable && !camera.GoesThrough(entry.Protocol) && !entry.HoldsUserData)
            .ToList();
        if (silent.Count == 0) return;

        foreach (var entry in silent) camera.Protocols.Remove(entry);
        await cameras.UpdateAsync(camera, ct);
    }
}
