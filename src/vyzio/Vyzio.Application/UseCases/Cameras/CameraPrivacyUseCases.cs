using System.Text.Json;
using Vyzio.Application.DTOs.Cameras;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Cameras;

// Resolution is via CameraCapabilityBinding + ICapabilityProviderRegistry (ADR-22) — never
// via VendorFamily/IVendorCameraAdapter. A strategy that requires a binding (hardware,
// ptz_parking) only calls the provider if a *verified* binding exists; otherwise it silently
// falls back to the Frigate-only software path rather than failing the whole toggle.
public sealed class ToggleCameraPrivacyModeUseCase(
    ICameraRepository cameras,
    ICameraCapabilityBindingRepository bindings,
    ICapabilityProviderRegistry registry,
    IFrigateConfigApplier frigateConfig)
{
    // PTZ parking move duration: drive camera to corner for this long, then stop.
    private static readonly TimeSpan ParkingMoveDuration = TimeSpan.FromSeconds(8);

    public async Task<CameraDto?> ExecuteAsync(string cameraId, bool active, PrivacyModeSource source = PrivacyModeSource.Manual, CancellationToken ct = default)
    {
        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null) return null;

        var strategy = camera.PrivacyModeStrategy;

        camera.PrivacyModeActive = active;
        camera.PrivacyModeSource = active ? source : null;
        camera.PrivacyVendorCut = false;

        switch (strategy)
        {
            case PrivacyModeStrategy.Hardware:
                // Vendor cuts the lens at firmware level (e.g. Tapo KLAP lens mask).
                if (await bindings.GetAsync(cameraId, CameraCapability.PrivacyMode, ct) is { Verified: true } privacyBinding)
                {
                    var provider = registry.ResolvePrivacy(privacyBinding.Protocol);
                    await provider.SetPrivacyModeAsync(camera, privacyBinding, active, ct);
                    camera.PrivacyVendorCut = active;
                }
                break;

            case PrivacyModeStrategy.PtzParking:
                // Camera pivots to a neutral zone AND Frigate is disabled — dual protection.
                if (await bindings.GetAsync(cameraId, CameraCapability.Ptz, ct) is { Verified: true } ptzBinding)
                {
                    var ptzProvider = registry.ResolvePtz(ptzBinding.Protocol);
                    if (active)
                    {
                        // Fire-and-forget stop after duration so the API response is immediate.
                        await ptzProvider.PtzMoveAsync(camera, ptzBinding, PtzDirection.DownLeft, speed: 80, ct);
                        _ = StopAfterDelayAsync(ptzProvider, camera, ptzBinding, ParkingMoveDuration);
                    }
                    else
                    {
                        // Return to surveillance position (preset 1).
                        // Frigate re-enabled below regardless; stream may briefly see a moving frame.
                        await ptzProvider.PtzGoToPresetAsync(camera, ptzBinding, presetId: 1, ct);
                    }
                }
                break;

            // "software" or any unknown value → Frigate only (no vendor call).
        }

        camera.UpdatedAt = DateTimeOffset.UtcNow;
        await cameras.UpdateAsync(camera, ct);

        var allCameras = await cameras.GetAllAsync(ct);
        await frigateConfig.ApplyAsync(allCameras, ct);

        return CameraDto.From(camera);
    }

    private static async Task StopAfterDelayAsync(IPtzCapabilityProvider provider, Camera camera, CameraCapabilityBinding binding, TimeSpan delay)
    {
        try
        {
            await Task.Delay(delay);
            await provider.PtzStopAsync(camera, binding);
        }
        catch
        {
            // Best-effort; camera will stop at mechanical limit if this fails.
        }
    }
}

public sealed class BatchToggleCameraPrivacyModeUseCase(
    ICameraRepository cameras,
    ICameraCapabilityBindingRepository bindings,
    ICapabilityProviderRegistry registry,
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
            camera.PrivacyModeSource = active ? PrivacyModeSource.Manual : null;
            camera.PrivacyVendorCut = false;

            if (await bindings.GetAsync(camera.Id, CameraCapability.PrivacyMode, ct) is { Verified: true } privacyBinding)
            {
                var provider = registry.ResolvePrivacy(privacyBinding.Protocol);
                await provider.SetPrivacyModeAsync(camera, privacyBinding, active, ct);
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
