using System.Globalization;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Vyzio.Application.DTOs.Cameras;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Cameras;

// Resolution is via CameraCapabilityBinding + ICapabilityProviderRegistry (ADR-22) — never
// via VendorFamily/IVendorCameraAdapter. Hardware strategy requires Verified=true on the
// HardwarePrivacy binding. PtzParking is inlined here: fetches the Ptz binding and calls
// PtzGoToPresetAsync(1): preset 1 is the parking position by convention (ADR-25), saved from
// the live view like any other preset.
public sealed class ToggleCameraPrivacyModeUseCase(
    ICameraRepository cameras,
    ICameraCapabilityBindingRepository bindings,
    ICapabilityProviderRegistry registry,
    IFrigateConfigApplier frigateConfig,
    ILogger<ToggleCameraPrivacyModeUseCase>? logger = null)
{
    public async Task<CameraDto?> ExecuteAsync(string cameraId, bool active, PrivacyModeSource source = PrivacyModeSource.Manual, CancellationToken ct = default)
    {
        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null) return null;

        // Asked before the entity changes: a camera that refuses leaves it as it was.
        var vendorCut = await PrivacyVendorAction.ApplyAsync(
            camera, active, bindings, registry, logger ?? (ILogger)NullLogger.Instance, ct);
        camera.PrivacyModeActive = active;
        camera.PrivacyModeSource = active ? source : null;
        camera.PrivacyVendorCut = vendorCut;

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
                var vendorCut = await PrivacyVendorAction.ApplyAsync(
                    camera, active, bindings, registry, logger ?? (ILogger)NullLogger.Instance, ct);
                camera.PrivacyModeActive = active;
                camera.PrivacyModeSource = active ? PrivacyModeSource.Manual : null;
                camera.PrivacyVendorCut = vendorCut;

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

// The camera's part of privacy, best effort: Vyzio stops recording whatever the camera answers (ADR-20).
internal static class PrivacyVendorAction
{
    // Returns whether the lens is cut by the camera itself, as far as the camera confirmed.
    public static async Task<bool> ApplyAsync(
        Camera camera,
        bool active,
        ICameraCapabilityBindingRepository bindings,
        ICapabilityProviderRegistry registry,
        ILogger logger,
        CancellationToken ct)
    {
        Func<Task>? deviceCall = null;
        switch (camera.PrivacyStrategy)
        {
            case PrivacyStrategy.Hardware:
                if (await bindings.GetAsync(camera.Id, CameraCapability.HardwarePrivacy, ct) is not { Verified: true } privacyBinding)
                    return false;
                var privacy = registry.ResolvePrivacy(privacyBinding.Protocol);
                deviceCall = () => privacy.SetPrivacyModeAsync(camera, privacyBinding, active, ct);
                break;

            case PrivacyStrategy.PtzParking:
                if (active && await bindings.GetAsync(camera.Id, CameraCapability.Ptz, ct) is { Verified: true } ptzBinding)
                {
                    var ptz = registry.ResolvePtz(ptzBinding.Protocol);
                    deviceCall = () => ptz.PtzGoToPresetAsync(camera, ptzBinding, presetId: 1, ct);
                }
                break;
        }

        if (deviceCall is null) return false;

        try
        {
            await deviceCall();
            return camera.PrivacyStrategy == PrivacyStrategy.Hardware && active;
        }
        // Only switching on is best effort; a lens left shut must not be shown as privacy off (SPECS 9.2).
        catch (Exception ex) when (active)
        {
            // A caller hanging up is not the camera failing; support must not read it as one.
            if (ex is OperationCanceledException && ct.IsCancellationRequested)
                logger.LogInformation("Privacy on for {CameraId}: the caller left before the camera answered; Vyzio applies it regardless.", camera.Id);
            else
                logger.LogWarning(ex, "Privacy on for {CameraId}: the camera did not follow ({Strategy}); Vyzio applies it regardless.",
                    camera.Id, camera.PrivacyStrategy);
            return false;
        }
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

        if (request.DaysOfWeek.Count == 0)
            throw new ArgumentException("At least one day of week is required.");
        if (!TimeSpan.TryParse(request.StartTime, CultureInfo.InvariantCulture, out var start)
            || !TimeSpan.TryParse(request.EndTime, CultureInfo.InvariantCulture, out var end))
            throw new ArgumentException("Invalid time format. Use HH:mm.");
        if (end <= start)
            throw new ArgumentException("EndTime must be after StartTime. For midnight crossing, use two schedules.");

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

        if (request.DaysOfWeek is not null)
        {
            if (request.DaysOfWeek.Count == 0)
                throw new ArgumentException("At least one day of week is required.");
            schedule.DaysOfWeek = JsonSerializer.Serialize(request.DaysOfWeek);
        }

        var newStart = request.StartTime is not null
            ? TimeSpan.Parse(request.StartTime, CultureInfo.InvariantCulture)
            : schedule.GetStartTime();
        var newEnd = request.EndTime is not null
            ? TimeSpan.Parse(request.EndTime, CultureInfo.InvariantCulture)
            : schedule.GetEndTime();

        if (newEnd <= newStart)
            throw new ArgumentException("EndTime must be after StartTime.");

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
