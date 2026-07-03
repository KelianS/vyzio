using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.CapabilityProviders;

// Universal fallback (ADR-20): Frigate `enabled: false` only, no firmware/PTZ interaction.
// Always available — every camera can fall back to this regardless of hardware.
public sealed class SoftwareOnlyPrivacyProvider : IPrivacyCapabilityProvider
{
    public CapabilityProtocol Protocol => CapabilityProtocol.SoftwareOnly;

    public Task<bool> ProbeAsync(Camera camera, CameraCapabilityBinding binding, CancellationToken ct = default)
        => Task.FromResult(true);

    public Task SetPrivacyModeAsync(Camera camera, CameraCapabilityBinding binding, bool active, CancellationToken ct = default)
        => Task.CompletedTask;
}
