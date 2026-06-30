using Microsoft.Extensions.Logging;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.CapabilityProviders;

// Privacy via PTZ parking (ADR-21, generalized by ADR-22): pivots the camera toward a
// mechanical limit instead of cutting the firmware. Decorates whichever IPtzCapabilityProvider
// is registered for the camera's Ptz binding — it has zero protocol-specific knowledge, so it
// automatically works with any future PTZ protocol without code changes.
// Depends on IEnumerable<IPtzCapabilityProvider> directly rather than ICapabilityProviderRegistry
// to avoid a DI construction cycle: the registry depends on all IPrivacyCapabilityProvider
// implementations (including this one), so this class cannot also depend on the registry.
public sealed class PtzParkingPrivacyProvider(
    IEnumerable<IPtzCapabilityProvider> ptzProviders,
    ICameraCapabilityBindingRepository bindings,
    ILogger<PtzParkingPrivacyProvider> logger) : IPrivacyCapabilityProvider
{
    private static readonly TimeSpan ParkingMoveDuration = TimeSpan.FromSeconds(8);

    public CapabilityProtocol Protocol => CapabilityProtocol.PtzParking;

    public async Task<bool> ProbeAsync(Camera camera, CameraCapabilityBinding binding, CancellationToken ct = default)
    {
        var ptzBinding = await ResolvePtzBindingAsync(camera, ct);
        if (ptzBinding is null) return false;

        var ptzProvider = ResolvePtzProvider(ptzBinding.Protocol);
        return await ptzProvider.ProbeAsync(camera, ptzBinding, ct);
    }

    public async Task SetPrivacyModeAsync(Camera camera, CameraCapabilityBinding binding, bool active, CancellationToken ct = default)
    {
        var ptzBinding = await ResolvePtzBindingAsync(camera, ct)
            ?? throw new InvalidOperationException($"Camera {camera.DisplayName} has no PTZ binding — ptz_parking requires one.");

        var ptzProvider = ResolvePtzProvider(ptzBinding.Protocol);

        if (active)
        {
            await ptzProvider.PtzMoveAsync(camera, ptzBinding, PtzDirection.DownLeft, speed: 80, ct);
            _ = StopAfterDelayAsync(ptzProvider, camera, ptzBinding, ParkingMoveDuration);
        }
        else
        {
            await ptzProvider.PtzGoToPresetAsync(camera, ptzBinding, presetId: 1, ct);
        }
    }

    private Task<CameraCapabilityBinding?> ResolvePtzBindingAsync(Camera camera, CancellationToken ct)
        => bindings.GetAsync(camera.Id, CameraCapability.Ptz, ct);

    private IPtzCapabilityProvider ResolvePtzProvider(CapabilityProtocol protocol)
        => ptzProviders.FirstOrDefault(p => p.Protocol == protocol)
            ?? throw new InvalidOperationException($"No IPtzCapabilityProvider registered for protocol '{protocol}'.");

    private static async Task StopAfterDelayAsync(IPtzCapabilityProvider provider, Camera camera, CameraCapabilityBinding binding, TimeSpan delay)
    {
        try
        {
            await Task.Delay(delay);
            await provider.PtzStopAsync(camera, binding);
        }
        catch
        {
            // Best-effort; camera will stop at mechanical limit if this fails.
        }
    }
}
