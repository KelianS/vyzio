using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Cameras;

// A1 (ADR-22): For cameras with a known VendorFamily, creates preset bindings that are missing
// then probes each one so the capability section is pre-filled on first open.
// A3 (ADR-28): For cameras without a VendorFamily, blind-probes every capability against every
// protocol that has a registered provider — same cascade as a vendor preset, just built from
// the registry instead of a curated list, since there's no vendor to narrow the candidates.
// Unlike the preset path, a capability that fails every candidate is deleted rather than left
// as a broken row — a preset's guess about a recognized vendor is worth surfacing as "not
// configured yet", but a blind guess on an unrecognized camera is not worth cluttering the UI.
// Each candidate protocol is asked once whether it answers, and a capability only tries those that do (ADR-61).
public sealed class SeedAndProbePresetsUseCase(
    ICameraRepository cameras,
    ICameraCapabilityBindingRepository bindings,
    ProbeCameraCapabilityUseCase probe,
    ICapabilityProviderRegistry registry,
    ICameraProtocolEndpointCache endpointCache,
    DetectionPlan detectionPlan,
    CameraProtocolSearch protocolSearch,
    IFrigateConfigApplier frigateConfigApplier)
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

        var plan = detectionPlan.StepsFor(camera);

        foreach (var (capability, protocols, deleteIfUnverified) in plan)
            await SeedAndProbeCapabilityAsync(cameraId, capability, protocols, deleteIfUnverified, run, ct);

        await DropSilentTriesAsync(cameraId, ct);
    }

    private static bool Answers(Camera camera, SupportedProtocol protocol) => camera.Protocol(protocol)?.Answers == true;

    private async Task SeedAndProbeCapabilityAsync(
        string cameraId,
        CameraCapability capability,
        IReadOnlyList<SupportedProtocol> protocols,
        bool deleteIfUnverified,
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

        // Already verified with a protocol still in the candidate list — nothing to retry.
        if (existing is { Verified: true } && protocols.Contains(existing.Protocol))
        {
            await probe.ExecuteAsync(cameraId, capability, ct: ct, run: run);
            return;
        }

        // Only the candidates that answered, in priority order; with none, the first one says why (ADR-61).
        var answering = protocols.Where(protocol => camera is not null && Answers(camera, protocol)).ToList();
        var candidates = answering.Count > 0 ? answering : [protocols[0]];

        // Try each candidate protocol in priority order (ADR-28), keep the first that verifies.
        CameraCapabilityBindingDto? result = null;
        foreach (var protocol in candidates)
        {
            var binding = existing ?? new CameraCapabilityBinding { CameraId = cameraId, Capability = capability };
            binding.Protocol = protocol;
            binding.Verified = false;
            binding.LastError = null;
            await bindings.SaveAsync(binding, ct);
            existing = binding;

            result = await probe.ExecuteAsync(cameraId, capability, ct: ct, run: run);
            if (result?.Verified == true) break;
        }

        if (deleteIfUnverified && result?.Verified != true)
            await bindings.DeleteAsync(cameraId, capability, ct);
    }

    // The first stream protocol that answers and whose stream check passes, in the registry's order (ADR-61 b).
    private async Task BindStreamAsync(string cameraId, IReadOnlyList<SupportedProtocol> candidates, ProtocolCheckRun run, CancellationToken ct)
    {
        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null) return;

        var answering = candidates.Where(protocol => Answers(camera, protocol)).ToList();
        if (answering.Count == 0) return;

        // A stream bound is a connection change, like a stream protocol chosen by hand.
        CameraConnectionChange.Apply(camera);
        await cameras.UpdateAsync(camera, ct);

        var binding = new CameraCapabilityBinding { CameraId = cameraId, Capability = CameraCapability.Stream };
        var verified = false;
        foreach (var protocol in answering)
        {
            verified = await TryStreamAsync(binding, protocol, run, ct);
            if (verified) break;
        }

        // With no stream check passing, the stream stays on the first protocol that answered, with its reason.
        if (!verified && answering.Count > 1)
            await TryStreamAsync(binding, answering[0], run, ct);

        await SurveillanceConfig.WriteAsync(cameras, frigateConfigApplier, ct);
    }

    private async Task<bool> TryStreamAsync(CameraCapabilityBinding binding, SupportedProtocol protocol, ProtocolCheckRun run, CancellationToken ct)
    {
        binding.Protocol = protocol;
        binding.Verified = false;
        binding.LastError = null;
        await bindings.SaveAsync(binding, ct);

        var result = await probe.ExecuteAsync(binding.CameraId, CameraCapability.Stream, run: run, ct: ct);
        return result?.Verified == true;
    }

    // The rows list what the camera speaks, not what Vyzio tried (ADR-61).
    private async Task DropSilentTriesAsync(string cameraId, CancellationToken ct)
    {
        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null) return;

        var used = (await bindings.GetByCameraAsync(cameraId, ct)).Select(b => b.Protocol).ToHashSet();
        var silent = camera.Protocols
            .Where(entry => entry.Status == ProtocolStatus.Unreachable && !used.Contains(entry.Protocol) && !entry.HoldsUserData)
            .ToList();
        if (silent.Count == 0) return;

        foreach (var entry in silent) camera.Protocols.Remove(entry);
        await cameras.UpdateAsync(camera, ct);
    }
}
