using System.Text.Json;
using Vyzio.Application.DTOs.Cameras;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Cameras;

public sealed class ToggleCameraPrivacyModeUseCase(
    ICameraRepository cameras,
    ICameraPrivacyRepository schedules,
    IVendorCameraAdapterFactory adapterFactory,
    IFrigateConfigApplier frigateConfig)
{
    public async Task<CameraDto?> ExecuteAsync(string cameraId, bool active, string source = "manual", CancellationToken ct = default)
    {
        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null) return null;

        camera.PrivacyModeActive = active;
        camera.PrivacyModeSource = active ? source : null;
        camera.PrivacyVendorCut = false;

        if (active)
        {
            var adapter = adapterFactory.Resolve(camera);
            if (await adapter.SupportsPrivacyModeAsync(camera, ct))
            {
                await adapter.SetPrivacyModeAsync(camera, active: true, ct);
                camera.PrivacyVendorCut = true;
            }
        }
        else
        {
            // Restore camera via vendor API if it was previously cut at hardware level
            var adapter = adapterFactory.Resolve(camera);
            if (await adapter.SupportsPrivacyModeAsync(camera, ct))
                await adapter.SetPrivacyModeAsync(camera, active: false, ct);
        }

        camera.UpdatedAt = DateTimeOffset.UtcNow;
        await cameras.UpdateAsync(camera, ct);

        var allCameras = await cameras.GetAllAsync(ct);
        await frigateConfig.ApplyAsync(allCameras, ct);

        return CameraDto.From(camera);
    }
}

public sealed class BatchToggleCameraPrivacyModeUseCase(
    ICameraRepository cameras,
    IVendorCameraAdapterFactory adapterFactory,
    IFrigateConfigApplier frigateConfig)
{
    public async Task<IReadOnlyList<CameraDto>> ExecuteAsync(
        IReadOnlyList<string> cameraIds,
        bool active,
        CancellationToken ct = default)
    {
        var allCameras = await cameras.GetAllAsync(ct);
        var targets = allCameras.Where(c => cameraIds.Contains(c.Id)).ToList();
        var updated = new List<CameraDto>(targets.Count);

        foreach (var camera in targets)
        {
            camera.PrivacyModeActive = active;
            camera.PrivacyModeSource = active ? "manual" : null;
            camera.PrivacyVendorCut = false;

            var adapter = adapterFactory.Resolve(camera);
            if (await adapter.SupportsPrivacyModeAsync(camera, ct))
            {
                await adapter.SetPrivacyModeAsync(camera, active, ct);
                camera.PrivacyVendorCut = active;
            }

            camera.UpdatedAt = DateTimeOffset.UtcNow;
            await cameras.UpdateAsync(camera, ct);
            updated.Add(CameraDto.From(camera));
        }

        // Single Frigate reload for the whole batch
        await frigateConfig.ApplyAsync(allCameras, ct);

        return updated;
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
        if (!TimeSpan.TryParse(request.StartTime, out var start) || !TimeSpan.TryParse(request.EndTime, out var end))
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
            ? TimeSpan.Parse(request.StartTime)
            : schedule.GetStartTime();
        var newEnd = request.EndTime is not null
            ? TimeSpan.Parse(request.EndTime)
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
