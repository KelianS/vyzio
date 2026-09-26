using System.Globalization;
using System.Text.Json;
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
    ILogger<ToggleCameraPrivacyModeUseCase>? logger = null)
{
    public async Task<CameraDto?> ExecuteAsync(string cameraId, bool active, PrivacyModeSource source = PrivacyModeSource.Manual, CancellationToken ct = default)
    {
        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null) return null;

        // Asked before the entity changes: a camera that refuses leaves it as it was.
        var answer = await PrivacyVendorAction.ApplyAsync(
            camera, active, bindings, registry, presets, logger ?? (ILogger)NullLogger.Instance, ct);
        camera.PrivacyModeActive = active;
        camera.PrivacyModeSource = active ? source : null;
        answer.ApplyTo(camera);

        // Applied to the end even if the caller hangs up: privacy must not stop half way.
        camera.UpdatedAt = DateTimeOffset.UtcNow;
        await cameras.UpdateAsync(camera, CancellationToken.None);

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
                    camera, active, bindings, registry, presets, logger ?? (ILogger)NullLogger.Instance, ct);
                camera.PrivacyModeActive = active;
                camera.PrivacyModeSource = active ? PrivacyModeSource.Manual : null;
                answer.ApplyTo(camera);

                camera.UpdatedAt = DateTimeOffset.UtcNow;
                await cameras.UpdateAsync(camera, CancellationToken.None);
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
                    if (await PtzPresetMove.GoToAsync(camera, ptzBinding, ptz, presets, slot, ct))
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

public sealed class GetCameraPrivacySchedulesUseCase(ICameraPrivacyRepository schedules)
{
    public async Task<IReadOnlyList<CameraPrivacyScheduleDto>> ExecuteAsync(string cameraId, CancellationToken ct = default)
    {
        var list = await schedules.GetSchedulesByCameraAsync(cameraId, ct);
        return list.Select(CameraPrivacyScheduleDto.From).ToList();
    }
}

/// <summary>A schedule the user can fix, answered as a refusal naming what to change, never as a failure (SPECS 9.2).</summary>
public sealed class InvalidPrivacyScheduleException(PrivacyScheduleRefusal refusal)
    : Exception(refusal switch
    {
        PrivacyScheduleRefusal.NoDay => "At least one day of week, 0 to 6, is required.",
        PrivacyScheduleRefusal.InvalidTime => "Start and end must both be times written HH:mm.",
        _ => "Start and end are the same time.",
    })
{
    public PrivacyScheduleRefusal Refusal { get; } = refusal;

    internal static void ThrowIfRefused(IReadOnlyList<int> daysOfWeek, string startTime, string endTime)
    {
        if (CameraPrivacySchedule.Check(daysOfWeek, startTime, endTime) is { } refusal)
            throw new InvalidPrivacyScheduleException(refusal);
    }
}

public sealed record CreatePrivacyScheduleRequest(
    IReadOnlyList<int> DaysOfWeek,
    string StartTime,
    string EndTime,
    bool Enabled = true);

public sealed class CreateCameraPrivacyScheduleUseCase(
    ICameraRepository cameras,
    ICameraPrivacyRepository schedules)
{
    public async Task<CameraPrivacyScheduleDto?> ExecuteAsync(
        string cameraId,
        CreatePrivacyScheduleRequest request,
        CancellationToken ct = default)
    {
        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null) return null;

        InvalidPrivacyScheduleException.ThrowIfRefused(request.DaysOfWeek, request.StartTime, request.EndTime);

        var schedule = new CameraPrivacySchedule
        {
            CameraId = cameraId,
            DaysOfWeek = JsonSerializer.Serialize(request.DaysOfWeek),
            StartTime = request.StartTime,
            EndTime = request.EndTime,
            Enabled = request.Enabled,
        };

        await schedules.AddScheduleAsync(schedule, ct);
        return CameraPrivacyScheduleDto.From(schedule);
    }
}

public sealed record UpdatePrivacyScheduleRequest(
    IReadOnlyList<int>? DaysOfWeek,
    string? StartTime,
    string? EndTime,
    bool? Enabled);

public sealed class UpdateCameraPrivacyScheduleUseCase(ICameraPrivacyRepository schedules)
{
    public async Task<CameraPrivacyScheduleDto?> ExecuteAsync(
        string scheduleId,
        UpdatePrivacyScheduleRequest request,
        CancellationToken ct = default)
    {
        var schedule = await schedules.GetScheduleByIdAsync(scheduleId, ct);
        if (schedule is null) return null;

        InvalidPrivacyScheduleException.ThrowIfRefused(
            request.DaysOfWeek ?? schedule.GetDaysOfWeek(),
            request.StartTime ?? schedule.StartTime,
            request.EndTime ?? schedule.EndTime);

        // Validated whole before anything changes, so a refusal leaves the tracked entity untouched.
        if (request.DaysOfWeek is not null) schedule.DaysOfWeek = JsonSerializer.Serialize(request.DaysOfWeek);
        if (request.StartTime is not null) schedule.StartTime = request.StartTime;
        if (request.EndTime is not null) schedule.EndTime = request.EndTime;
        if (request.Enabled.HasValue) schedule.Enabled = request.Enabled.Value;

        await schedules.UpdateScheduleAsync(schedule, ct);
        return CameraPrivacyScheduleDto.From(schedule);
    }
}

public sealed class DeleteCameraPrivacyScheduleUseCase(ICameraPrivacyRepository schedules)
{
    public async Task<bool> ExecuteAsync(string scheduleId, CancellationToken ct = default)
    {
        var schedule = await schedules.GetScheduleByIdAsync(scheduleId, ct);
        if (schedule is null) return false;
        await schedules.DeleteScheduleAsync(schedule, ct);
        return true;
    }
}
