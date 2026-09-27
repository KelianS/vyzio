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
    CameraProtocolCheck protocolCheck)
{
    private static readonly CameraCapability[] BlindProbeCapabilities =
        [CameraCapability.Ptz, CameraCapability.HardwarePrivacy, CameraCapability.ImageSettings];

    public async Task ExecuteAsync(string cameraId, CancellationToken ct = default)
    {
        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null) return;

        // "Look at this camera again": forget once for the whole cascade, not per candidate (ADR-56).
        CameraEndpointForgetting.Forget(camera, endpointCache);

        var preset = camera.VendorFamily is { } vf ? VendorCapabilityPresets.GetByVendorFamily(vf) : null;
        var plan = preset is not null
            ? preset.DefaultBindings.Select(b => (b.Capability, b.Protocols, DeleteIfUnverified: false)).ToList()
            : BlindProbeCapabilities
                .Select(capability => (Capability: capability, Protocols: registry.GetRegisteredProtocols(capability), DeleteIfUnverified: true))
                .Where(step => step.Protocols.Count > 0)
                .ToList();

        var run = new ProtocolCheckRun();
        foreach (var protocol in plan.SelectMany(step => step.Protocols).Distinct())
            await protocolCheck.CheckAsync(camera, protocol, run, ct);
        await cameras.UpdateAsync(camera, ct);

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
