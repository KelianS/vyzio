using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Cameras;

// A1 (ADR-22): For cameras with a known VendorFamily, creates preset bindings that are missing
// then probes each one so the capability section is pre-filled on first open.
// A3 (ADR-21): For cameras without a VendorFamily, attempts ONVIF PTZ detection and creates a
// Ptz/Onvif binding only if the probe succeeds — avoids polluting the UI for unlisted cameras.
public sealed class SeedAndProbePresetsUseCase(
    ICameraRepository cameras,
    ICameraCapabilityBindingRepository bindings,
    ProbeCameraCapabilityUseCase probe)
{
    public async Task ExecuteAsync(string cameraId, CancellationToken ct = default)
    {
        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null) return;

        var preset = camera.VendorFamily is { } vf ? VendorCapabilityPresets.GetByVendorFamily(vf) : null;

        if (preset is not null)
        {
            await SeedAndProbePresetAsync(cameraId, preset, ct);
        }
        else
        {
            await TryDetectOnvifPtzAsync(cameraId, ct);
        }
    }

    private async Task SeedAndProbePresetAsync(string cameraId, VendorCapabilityPreset preset, CancellationToken ct)
    {
        foreach (var (capability, protocols) in preset.DefaultBindings)
        {
            var existing = await bindings.GetAsync(cameraId, capability, ct);

            // A manual override (ADR-28) is never touched by re-running detection, whether it
            // currently works or not — the user's choice stands until they change it themselves.
            if (existing is { ManuallyConfigured: true })
            {
                await probe.ExecuteAsync(cameraId, capability, ct);
                continue;
            }

            // Already verified with a protocol still declared by the preset — nothing to retry.
            if (existing is { Verified: true } && protocols.Contains(existing.Protocol))
            {
                await probe.ExecuteAsync(cameraId, capability, ct);
                continue;
            }

            // Try each candidate protocol in priority order (ADR-28), keep the first that verifies.
            foreach (var protocol in protocols)
            {
                var binding = existing ?? new CameraCapabilityBinding { CameraId = cameraId, Capability = capability };
                binding.Protocol = protocol;
                binding.Verified = false;
                binding.LastError = null;
                await bindings.SaveAsync(binding, ct);
                existing = binding;

                var result = await probe.ExecuteAsync(cameraId, capability, ct);
                if (result?.Verified == true) break;
            }
        }
    }

    private async Task TryDetectOnvifPtzAsync(string cameraId, CancellationToken ct)
    {
        if (await bindings.GetAsync(cameraId, CameraCapability.Ptz, ct) is not null)
            return;

        await bindings.SaveAsync(new CameraCapabilityBinding
        {
            CameraId = cameraId,
            Capability = CameraCapability.Ptz,
            Protocol = SupportedProtocol.Onvif,
            Verified = false,
        }, ct);

        var result = await probe.ExecuteAsync(cameraId, CameraCapability.Ptz, ct);

        if (result is null || !result.Verified)
            await bindings.DeleteAsync(cameraId, CameraCapability.Ptz, ct);
    }
}
