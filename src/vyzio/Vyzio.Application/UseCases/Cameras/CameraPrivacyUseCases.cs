using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Vyzio.Application.DTOs.Cameras;
using Vyzio.Core.Common;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Cameras;

// Resolved through capability bindings, never the brand (ADR-22); parking and its return follow ADR-57.
public sealed class ToggleCameraPrivacyModeUseCase(
    ICameraRepository cameras,
    ICameraCapabilityBindingRepository bindings,
    ICapabilityProviderRegistry registry,
    IFrigateConfigApplier frigateConfig,
    IPtzPresetRepository presets,
    PtzManagedPositions positions,
    ILiveStreamRelay live,
    ILogger<ToggleCameraPrivacyModeUseCase>? logger = null)
{
    public async Task<CameraDto?> ExecuteAsync(string cameraId, bool active, PrivacyModeSource source = PrivacyModeSource.Manual, CancellationToken ct = default)
    {
        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null) return null;

        // Asked before the entity changes: a camera that refuses leaves it as it was.
        var answer = await PrivacyVendorAction.ApplyAsync(
            camera, active, bindings, registry, presets, positions, logger ?? (ILogger)NullLogger.Instance, ct);
        camera.PrivacyModeActive = active;
        camera.PrivacyModeSource = active ? source : null;
        answer.ApplyTo(camera);

        // Applied to the end even if the caller hangs up: privacy must not stop half way.
        camera.UpdatedAt = DateTimeOffset.UtcNow;
        await cameras.UpdateAsync(camera, CancellationToken.None);
        // Once saved, so no new live view opens behind the cut; the open ones stop now, not at Frigate's restart (ADR-72 b).
        if (active) live.Cut(camera.Id);

        var allCameras = await cameras.GetAllAsync(CancellationToken.None);
        await frigateConfig.ApplyAsync(allCameras, CancellationToken.None);

        return CameraDto.From(camera);
    }
}

public sealed class BatchToggleCameraPrivacyModeUseCase(
    ICameraRepository cameras,
    ICameraCapabilityBindingRepository bindings,
    ICapabilityProviderRegistry registry,
    IFrigateConfigApplier frigateConfig,
    IPtzPresetRepository presets,
    PtzManagedPositions positions,
    ILiveStreamRelay live,
    ILogger<BatchToggleCameraPrivacyModeUseCase>? logger = null)
{
    public async Task<IReadOnlyList<CameraDto>> ExecuteAsync(
        IReadOnlyList<string> cameraIds,
        bool active,
        CancellationToken ct = default)
    {
        var allCameras = await cameras.GetAllAsync(ct);
        var targets = allCameras.Where(c => cameraIds.Contains(c.Id)).ToList();
        var updated = new List<CameraDto>(targets.Count);

        try
        {
            foreach (var camera in targets)
            {
                // Asked before the entity changes: a camera that fails here keeps its saved state in the reload.
                var answer = await PrivacyVendorAction.ApplyAsync(
                    camera, active, bindings, registry, presets, positions, logger ?? (ILogger)NullLogger.Instance, ct);
                camera.PrivacyModeActive = active;
                camera.PrivacyModeSource = active ? PrivacyModeSource.Manual : null;
                answer.ApplyTo(camera);

                camera.UpdatedAt = DateTimeOffset.UtcNow;
                await cameras.UpdateAsync(camera, CancellationToken.None);
                if (active) live.Cut(camera.Id);
                updated.Add(CameraDto.From(camera));
            }
        }
        catch (Exception ex)
        {
            // Logged now: a failing reload below would replace it on the way out.
            (logger ?? (ILogger)NullLogger.Instance).LogError(ex, "Privacy batch stopped part way; reloading Frigate for the cameras already saved.");
            throw;
        }
        finally
        {
            // One reload for the batch, even stopped half way or hung up: a saved camera must stop recording.
            await frigateConfig.ApplyAsync(allCameras, CancellationToken.None);
        }

        return updated;
    }
}

// What the camera did with the last toggle: the lens cut it confirmed, or why it did not follow (SPECS 9.2).
internal sealed record PrivacyCameraAnswer(bool VendorCut, PrivacyMiss? Miss = null, string? MissDetail = null)
{
    public static readonly PrivacyCameraAnswer Followed = new(VendorCut: false);

    public static PrivacyCameraAnswer Missed(PrivacyMiss miss, string detail) =>
        new(VendorCut: false, miss, detail.Length > Camera.PrivacyMissDetailLength ? detail[..Camera.PrivacyMissDetailLength] : detail);

    public void ApplyTo(Camera camera)
    {
        camera.PrivacyVendorCut = VendorCut;
        camera.PrivacyMiss = Miss;
        camera.PrivacyMissDetail = MissDetail;
    }
}

// The camera's part of privacy, best effort: Vyzio stops recording whatever the camera answers (ADR-20).
internal static class PrivacyVendorAction
{
    public static async Task<PrivacyCameraAnswer> ApplyAsync(
        Camera camera,
        bool active,
        ICameraCapabilityBindingRepository bindings,
        ICapabilityProviderRegistry registry,
        IPtzPresetRepository presets,
        PtzManagedPositions positions,
        ILogger logger,
        CancellationToken ct)
    {
        var state = active ? "on" : "off";
        var asked = $"privacy {state}, {SnakeCaseEnum.ToSnakeCase(camera.PrivacyStrategy)}";
        Func<Task<PrivacyCameraAnswer>> deviceCall;
        switch (camera.PrivacyStrategy)
        {
            case PrivacyStrategy.Hardware:
                // An unverified lens was never cut, so switching off has nothing to reopen.
                if (await bindings.GetAsync(camera.Id, CameraCapability.HardwarePrivacy, ct) is not { Verified: true } privacyBinding)
                    return active ? Unverified(CameraCapability.HardwarePrivacy) : PrivacyCameraAnswer.Followed;
                var privacy = registry.ResolvePrivacy(privacyBinding.Protocol);
                deviceCall = async () =>
                {
                    await privacy.SetPrivacyModeAsync(camera, privacyBinding, active, ct);
                    return new PrivacyCameraAnswer(VendorCut: active);
                };
                break;

            case PrivacyStrategy.PtzParking:
                // An unverified camera was never parked, so switching off has nowhere to come back from.
                if (await bindings.GetAsync(camera.Id, CameraCapability.Ptz, ct) is not { Verified: true } ptzBinding)
                    return active ? Unverified(CameraCapability.Ptz) : PrivacyCameraAnswer.Followed;
                var ptz = registry.ResolvePtz(ptzBinding.Protocol);
                var slot = active ? PtzPreset.ParkingSlot : PtzPreset.SurveillanceSlot;
                deviceCall = async () =>
                {
                    if (await PtzPresetMove.GoToAsync(camera, ptzBinding, ptz, positions, presets, slot, ct))
                        return PrivacyCameraAnswer.Followed;
                    // A slot never saved is a missing setup step, not the camera failing: support must read it so.
                    logger.LogWarning("Privacy {State} on {CameraId}: no {Slot} position is saved, so the camera stays where it is.",
                        state, camera.Id, PtzPreset.DefaultLabel(slot));
                    return PrivacyCameraAnswer.Missed(PrivacyMiss.PositionMissing, $"{asked}: no {PtzPreset.DefaultLabel(slot)} position is saved");
                };
                break;

            default:
                return PrivacyCameraAnswer.Followed;
        }

        try
        {
            return await deviceCall();
        }
        // Best effort, except a lens left shut: it must not be shown as privacy off (SPECS 9.2, ADR-57).
        catch (Exception ex) when (active || camera.PrivacyStrategy == PrivacyStrategy.PtzParking)
        {
            // A caller hanging up is not the camera failing; support must not read it as one.
            if (ex is OperationCanceledException && ct.IsCancellationRequested)
            {
                logger.LogInformation("Privacy {State} on {CameraId}: the caller left before the camera answered; Vyzio applies it regardless.",
                    state, camera.Id);
                return PrivacyCameraAnswer.Missed(PrivacyMiss.Unconfirmed, $"{asked}: interrupted before the camera answered");
            }
            logger.LogWarning(ex, "Privacy {State} on {CameraId}: the camera did not follow ({Strategy}); Vyzio applies it regardless.",
                state, camera.Id, camera.PrivacyStrategy);
            return PrivacyCameraAnswer.Missed(PrivacyMiss.CameraFailed, $"{asked}: {ex.GetType().Name}: {ex.Message}");
        }

        PrivacyCameraAnswer Unverified(CameraCapability capability) =>
            PrivacyCameraAnswer.Missed(PrivacyMiss.CapabilityUnverified, $"{asked}: the {SnakeCaseEnum.ToSnakeCase(capability)} capability is not verified");
    }
}
