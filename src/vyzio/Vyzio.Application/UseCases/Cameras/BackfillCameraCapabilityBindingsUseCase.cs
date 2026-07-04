using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Cameras;

// One-time-per-camera data migration (ADR-22): reconstructs CameraCapabilityBinding rows from
// the legacy Camera fields (VendorFamily, PtzSupported, PrivacyModeStrategy, PrivacyVendorCut)
// so already-active capabilities keep working identically through the new provider system.
//
// Idempotent — only fills bindings that don't already exist, so it is safe to run on every
// startup (same pattern as dbContext.Database.Migrate()).
//
// Deliberately does NOT backfill Ptz/TapoKlap for existing Tapo cameras: PTZ over KLAP is a
// newly exposed capability that has never been verified on this install, so it must go through
// a real probe before being offered — never auto-activated (SPECS §2.3, ADR-22 migration notes).
public sealed class BackfillCameraCapabilityBindingsUseCase(
    ICameraRepository cameras,
    ICameraCapabilityBindingRepository bindings)
{
    public async Task ExecuteAsync(CancellationToken ct = default)
    {
        var allCameras = await cameras.GetAllAsync(ct);

        foreach (var camera in allCameras)
        {
            await BackfillPrivacyAsync(camera, ct);
            await BackfillPtzAsync(camera, ct);
        }
    }

    private async Task BackfillPrivacyAsync(Camera camera, CancellationToken ct)
    {
        if (await bindings.GetAsync(camera.Id, CameraCapability.PrivacyMode, ct) is not null)
            return;

        CapabilityProtocol? protocol = camera.PrivacyModeStrategy switch
        {
            PrivacyModeStrategy.Hardware when camera.VendorFamily == VendorFamily.TplinkTapo => CapabilityProtocol.TapoKlap,
            PrivacyModeStrategy.PtzParking => CapabilityProtocol.PtzParking,
            _ => null,
        };

        if (protocol is null) return;

        await bindings.SaveAsync(new CameraCapabilityBinding
        {
            CameraId = camera.Id,
            Capability = CameraCapability.PrivacyMode,
            Protocol = protocol.Value,
            Verified = camera.PrivacyVendorCut,
            VerifiedAt = camera.PrivacyVendorCut ? camera.UpdatedAt : null,
        }, ct);
    }

    private async Task BackfillPtzAsync(Camera camera, CancellationToken ct)
    {
        if (!camera.PtzSupported) return;
        if (await bindings.GetAsync(camera.Id, CameraCapability.Ptz, ct) is not null)
            return;

        CapabilityProtocol? protocol = camera.VendorFamily switch
        {
            VendorFamily.Icsee   => CapabilityProtocol.Dvrip,
            VendorFamily.V380Pro => CapabilityProtocol.V380,
            _                    => null,
        };

        if (protocol is null) return;

        await bindings.SaveAsync(new CameraCapabilityBinding
        {
            CameraId = camera.Id,
            Capability = CameraCapability.Ptz,
            Protocol = protocol.Value,
            Verified = true,
            VerifiedAt = camera.UpdatedAt,
        }, ct);
    }
}
