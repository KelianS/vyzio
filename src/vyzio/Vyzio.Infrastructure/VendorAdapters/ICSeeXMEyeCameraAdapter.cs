using Microsoft.Extensions.Logging;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.VendorAdapters;

// ICSee / XMEye cameras (Xiongmai chipset) use the proprietary DVRIP protocol (port 34567).
//
// Privacy mode investigation summary (June 2026, tested on 192.168.1.193):
//   - VideoEnable=False (Simplify.Encode, AVEnc.Encode.[0]) → Ret 606 (firmware blocks writes)
//   - PrivacyMask full-frame → Ret 100 but NO effect on stream (camera uses XMEye P2P cloud)
//   - VideoColor (Brightness, Contrast) → Ret 100 but NO effect on stream
//   - Camera.Param/ParamEx (exposure, gain) → Ret 100 but NO effect on stream
//   - OPMachine Sleep/Standby → Ret 103 (firmware does not implement these)
//   - OPMonitor Claim → Ret 100 but ICSee app bypasses local DVRIP via XMEye P2P cloud
//   - PTZ parking (OPPTZControl cmd 1400) → CONFIRMED WORKING, belongs to 1.0.1-P2
//
// For 1.0.1-P1: privacy is ensured by Frigate + go2rtc enabled:false (software fallback).
// PTZ parking will be implemented in 1.0.1-P2 with full UI configuration.
public sealed class ICSeeXMEyeCameraAdapter(ILogger<ICSeeXMEyeCameraAdapter> logger) : IVendorCameraAdapter
{
    public string VendorFamily => "icsee";

    public Task<bool> SupportsPrivacyModeAsync(Camera camera, CancellationToken ct = default)
    {
        logger.LogDebug("ICSee/XMEye: hardware privacy not available in this version for {Camera}. Frigate fallback applies.", camera.DisplayName);
        return Task.FromResult(false);
    }

    public Task SetPrivacyModeAsync(Camera camera, bool active, CancellationToken ct = default)
        => Task.CompletedTask;
}
