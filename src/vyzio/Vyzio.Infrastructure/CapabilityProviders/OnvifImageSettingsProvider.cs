using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.VendorAdapters;

namespace Vyzio.Infrastructure.CapabilityProviders;

// IImageSettingsCapabilityProvider for the ONVIF protocol (ADR-27) — same brand coverage as
// OnvifPtzProvider (V380 Pro, Hikvision, Dahua, Reolink, Axis...). No local caching needed:
// unlike PTZ profile tokens, image settings are read/written once per call, not hot-path.
//
// Unlike PTZ/media calls elsewhere in OnvifClient (which tolerate silent failure with built-in
// fallbacks), the token/settings calls here throw OnvifCallException on failure — left to
// propagate so ProbeCameraCapabilityUseCase's own try/catch captures ex.Message as LastError,
// surfacing the real reason to the UI instead of a generic message (ADR-28 follow-up).
internal sealed class OnvifImageSettingsProvider(OnvifClient onvif) : IImageSettingsCapabilityProvider
{
    public SupportedProtocol Protocol => SupportedProtocol.Onvif;

    public async Task<bool> ProbeAsync(Camera camera, CameraCapabilityBinding binding, CancellationToken ct = default)
    {
        var token = await onvif.GetVideoSourceTokenAsync(camera, ct);
        var settings = await onvif.GetImagingSettingsAsync(camera, token, ct);
        return settings is not null;
    }

    public async Task<CameraImageSettings?> GetImageSettingsAsync(Camera camera, CameraCapabilityBinding binding, CancellationToken ct = default)
    {
        var token = await onvif.GetVideoSourceTokenAsync(camera, ct);
        return await onvif.GetImagingSettingsAsync(camera, token, ct);
    }

    public async Task SetImageSettingsAsync(Camera camera, CameraCapabilityBinding binding, CameraImageSettings settings, CancellationToken ct = default)
    {
        var token = await onvif.GetVideoSourceTokenAsync(camera, ct);
        await onvif.SetImagingSettingsAsync(camera, token, settings, ct);
    }
}
