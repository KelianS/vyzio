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
public sealed class SeedAndProbePresetsUseCase(
    ICameraRepository cameras,
    ICameraCapabilityBindingRepository bindings,
    ProbeCameraCapabilityUseCase probe,
    ICapabilityProviderRegistry registry)
{
    private static readonly CameraCapability[] BlindProbeCapabilities =
        [CameraCapability.Ptz, CameraCapability.HardwarePrivacy, CameraCapability.ImageSettings];

    public async Task ExecuteAsync(string cameraId, CancellationToken ct = default)
    {
        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null) return;

        var preset = camera.VendorFamily is { } vf ? VendorCapabilityPresets.GetByVendorFamily(vf) : null;

        if (preset is not null)
        {
            foreach (var (capability, protocols) in preset.DefaultBindings)
                await SeedAndProbeCapabilityAsync(cameraId, capability, protocols, deleteIfUnverified: false, ct);
        }
        else
        {
            foreach (var capability in BlindProbeCapabilities)
            {
                var protocols = registry.GetRegisteredProtocols(capability);
                if (protocols.Count == 0) continue;
                await SeedAndProbeCapabilityAsync(cameraId, capability, protocols, deleteIfUnverified: true, ct);
            }
        }
    }

    private async Task SeedAndProbeCapabilityAsync(
        string cameraId,
        CameraCapability capability,
        IReadOnlyList<SupportedProtocol> protocols,
        bool deleteIfUnverified,
        CancellationToken ct)
    {
        var existing = await bindings.GetAsync(cameraId, capability, ct);

        // A manual override (ADR-28) is never touched by re-running detection, whether it
        // currently works or not — the user's choice stands until they change it themselves.
        if (existing is { ManuallyConfigured: true })
        {
            await probe.ExecuteAsync(cameraId, capability, ct);
            return;
        }

        // Already verified with a protocol still in the candidate list — nothing to retry.
        if (existing is { Verified: true } && protocols.Contains(existing.Protocol))
        {
            await probe.ExecuteAsync(cameraId, capability, ct);
            return;
        }

        // Try each candidate protocol in priority order (ADR-28), keep the first that verifies.
        CameraCapabilityBindingDto? result = null;
        foreach (var protocol in protocols)
        {
            var binding = existing ?? new CameraCapabilityBinding { CameraId = cameraId, Capability = capability };
            binding.Protocol = protocol;
            binding.Verified = false;
            binding.LastError = null;
            await bindings.SaveAsync(binding, ct);
            existing = binding;

            result = await probe.ExecuteAsync(cameraId, capability, ct);
            if (result?.Verified == true) break;
        }

        if (deleteIfUnverified && result?.Verified != true)
            await bindings.DeleteAsync(cameraId, capability, ct);
    }
}
