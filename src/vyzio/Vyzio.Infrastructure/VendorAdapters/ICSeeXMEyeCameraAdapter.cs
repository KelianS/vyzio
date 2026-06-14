using Microsoft.Extensions.Logging;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.VendorAdapters;

// ICSee / XMEye cameras (Xiongmai chipset) use the proprietary DVRIP protocol (port 34567).
// Hardware-level privacy cut via DVRIP is not implemented:
//   - Stopping the DVRIP stream for all LAN clients from a third-party connection is not
//     reliably supported across firmware versions (no documented "disable video output" command).
//   - Privacy is ensured by Frigate + go2rtc enabled:false, which stops all RTSP proxy access.
//   - The raw DVRIP port (34567) remains open on the LAN but requires camera credentials.
// PrivacyVendorCut will be false for these cameras; the UI will show "enregistrement désactivé".
public sealed class ICSeeXMEyeCameraAdapter(ILogger<ICSeeXMEyeCameraAdapter> logger) : IVendorCameraAdapter
{
    public string VendorFamily => "icsee";

    public Task<bool> SupportsPrivacyModeAsync(Camera camera, CancellationToken ct = default)
    {
        logger.LogDebug("ICSee/XMEye: hardware privacy cut not supported for {Camera}. Frigate fallback will apply.", camera.DisplayName);
        return Task.FromResult(false);
    }

    public Task SetPrivacyModeAsync(Camera camera, bool active, CancellationToken ct = default)
        => Task.CompletedTask;
}
