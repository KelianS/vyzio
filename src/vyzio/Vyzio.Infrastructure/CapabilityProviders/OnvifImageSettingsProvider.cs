using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.VendorAdapters;

namespace Vyzio.Infrastructure.CapabilityProviders;

// Image settings over ONVIF; failures propagate so the probe records the camera's real reason (ADR-27/28).
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
