using Microsoft.Extensions.Logging;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.VendorAdapters;

// V380 PRO cameras expose RTSP via a firmware unlock (ceshi.ini SD card method).
// They have no known local HTTP/vendor API for hardware-level privacy control.
// Privacy is ensured by Frigate enabled:false (stops RTSP ingestion).
// PrivacyVendorCut will be false for these cameras; the UI will show "enregistrement désactivé".
public sealed class V380ProCameraAdapter(ILogger<V380ProCameraAdapter> logger) : IVendorCameraAdapter
{
    public string VendorFamily => "v380_pro";

    public Task<bool> SupportsPrivacyModeAsync(Camera camera, CancellationToken ct = default)
    {
        logger.LogDebug("V380 PRO: hardware privacy cut not supported for {Camera}. Frigate fallback will apply.", camera.DisplayName);
        return Task.FromResult(false);
    }

    public Task SetPrivacyModeAsync(Camera camera, bool active, CancellationToken ct = default)
        => Task.CompletedTask;
}
