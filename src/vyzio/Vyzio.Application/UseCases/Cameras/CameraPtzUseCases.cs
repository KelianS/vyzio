using Vyzio.Application.DTOs.Cameras;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Cameras;

public sealed record PtzMoveRequest(string Direction, int Speed = 50);

public sealed class PtzMoveUseCase(ICameraRepository cameras, IVendorCameraAdapterFactory adapterFactory)
{
    public async Task<bool> ExecuteAsync(string cameraId, PtzMoveRequest request, CancellationToken ct = default)
    {
        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null) return false;

        if (!Enum.TryParse<PtzDirection>(request.Direction, ignoreCase: true, out var direction))
            throw new ArgumentException($"Unknown PTZ direction '{request.Direction}'.");

        var adapter = adapterFactory.Resolve(camera);
        if (!await adapter.SupportsPtzAsync(camera, ct)) return false;

        await adapter.PtzMoveAsync(camera, direction, Math.Clamp(request.Speed, 1, 100), ct);
        return true;
    }
}

public sealed class PtzStopUseCase(ICameraRepository cameras, IVendorCameraAdapterFactory adapterFactory)
{
    public async Task<bool> ExecuteAsync(string cameraId, CancellationToken ct = default)
    {
        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null) return false;

        var adapter = adapterFactory.Resolve(camera);
        if (!await adapter.SupportsPtzAsync(camera, ct)) return false;

        await adapter.PtzStopAsync(camera, ct);
        return true;
    }
}

public sealed class PtzSavePresetUseCase(ICameraRepository cameras, IVendorCameraAdapterFactory adapterFactory)
{
    public async Task<bool> ExecuteAsync(string cameraId, int presetId, CancellationToken ct = default)
    {
        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null) return false;

        var adapter = adapterFactory.Resolve(camera);
        if (!await adapter.SupportsPtzAsync(camera, ct)) return false;

        await adapter.PtzSavePresetAsync(camera, presetId, ct);
        return true;
    }
}

public sealed class PtzGoToPresetUseCase(ICameraRepository cameras, IVendorCameraAdapterFactory adapterFactory)
{
    public async Task<bool> ExecuteAsync(string cameraId, int presetId, CancellationToken ct = default)
    {
        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null) return false;

        var adapter = adapterFactory.Resolve(camera);
        if (!await adapter.SupportsPtzAsync(camera, ct)) return false;

        await adapter.PtzGoToPresetAsync(camera, presetId, ct);
        return true;
    }
}

// Saves the current camera position as the surveillance home preset (preset ID 1).
// Called from the fiche caméra when the user clicks "Définir position de surveillance".
public sealed class ConfigurePtzParkingPositionUseCase(
    ICameraRepository cameras,
    IVendorCameraAdapterFactory adapterFactory)
{
    public async Task<bool> ExecuteAsync(string cameraId, CancellationToken ct = default)
    {
        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null) return false;

        var adapter = adapterFactory.Resolve(camera);
        if (!await adapter.SupportsPtzAsync(camera, ct)) return false;

        // Preset 1 = surveillance/home position by convention.
        await adapter.PtzSavePresetAsync(camera, presetId: 1, ct);
        return true;
    }
}

public sealed record SetPrivacyStrategyRequest(string Strategy);

public sealed class SetCameraPrivacyStrategyUseCase(ICameraRepository cameras)
{
    private static readonly HashSet<string> ValidStrategies = ["software", "ptz_parking", "hardware"];

    public async Task<CameraDto?> ExecuteAsync(string cameraId, SetPrivacyStrategyRequest request, CancellationToken ct = default)
    {
        if (!ValidStrategies.Contains(request.Strategy))
            throw new ArgumentException($"Invalid privacy strategy '{request.Strategy}'. Valid values: {string.Join(", ", ValidStrategies)}.");

        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null) return null;

        camera.PrivacyModeStrategy = request.Strategy;
        camera.UpdatedAt = DateTimeOffset.UtcNow;
        await cameras.UpdateAsync(camera, ct);

        return CameraDto.From(camera);
    }
}
