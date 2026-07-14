using Microsoft.Extensions.Logging;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.VendorAdapters;

namespace Vyzio.Infrastructure.CapabilityProviders;

// IImageSettingsCapabilityProvider for the ONVIF protocol (ADR-27) — same brand coverage as
// OnvifPtzProvider (V380 Pro, Hikvision, Dahua, Reolink, Axis...). No local caching needed:
// unlike PTZ profile tokens, image settings are read/written once per call, not hot-path.
internal sealed class OnvifImageSettingsProvider(OnvifClient onvif, ILogger<OnvifImageSettingsProvider> logger) : IImageSettingsCapabilityProvider
{
    public SupportedProtocol Protocol => SupportedProtocol.Onvif;

    public async Task<bool> ProbeAsync(Camera camera, CameraCapabilityBinding binding, CancellationToken ct = default)
    {
        try
        {
            var token = await onvif.GetVideoSourceTokenAsync(camera, ct);
            if (string.IsNullOrWhiteSpace(token)) return false;

            var settings = await onvif.GetImagingSettingsAsync(camera, token, ct);
            return settings is not null;
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "ONVIF image settings probe failed for {Camera}.", camera.DisplayName);
            return false;
        }
    }

    public async Task<CameraImageSettings?> GetImageSettingsAsync(Camera camera, CameraCapabilityBinding binding, CancellationToken ct = default)
    {
        var token = await onvif.GetVideoSourceTokenAsync(camera, ct);
        if (string.IsNullOrWhiteSpace(token)) return null;

        return await onvif.GetImagingSettingsAsync(camera, token, ct);
    }

    public async Task SetImageSettingsAsync(Camera camera, CameraCapabilityBinding binding, CameraImageSettings settings, CancellationToken ct = default)
    {
        var token = await onvif.GetVideoSourceTokenAsync(camera, ct);
        if (string.IsNullOrWhiteSpace(token)) return;

        await onvif.SetImagingSettingsAsync(camera, token, settings, ct);
    }
}
