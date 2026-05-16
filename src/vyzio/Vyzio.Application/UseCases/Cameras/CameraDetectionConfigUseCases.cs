using System.Text.Json;
using Vyzio.Application.DTOs.Cameras;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Cameras;

public sealed class GetCameraDetectionConfigUseCase(ICameraRepository cameras)
{
    public async Task<CameraDetectionConfigDto?> ExecuteAsync(string cameraId, CancellationToken ct = default)
    {
        var camera = await cameras.GetByIdAsync(cameraId, ct);
        return camera is null ? null : CameraDetectionConfigDto.From(camera);
    }
}

public sealed class SaveCameraDetectionConfigUseCase(
    ICameraRepository cameras,
    IFrigateConfigApplier frigateConfigApplier)
{
    public async Task<CameraDetectionConfigDto?> ExecuteAsync(
        string cameraId,
        SaveCameraDetectionConfigRequest request,
        CancellationToken ct = default)
    {
        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null)
            return null;

        var validatedLabels = request.Labels
            .Where(l => !string.IsNullOrWhiteSpace(l))
            .Select(l => l.Trim().ToLowerInvariant())
            .Where(KnownDetectionLabels.IsValid)
            .Distinct()
            .ToList();

        if (validatedLabels.Count == 0)
            validatedLabels = ["person"];

        camera.DetectionLabelsJson = JsonSerializer.Serialize(validatedLabels);
        camera.ContinuousRecordingEnabled = request.ContinuousRecordingEnabled;
        camera.UpdatedAt = DateTimeOffset.UtcNow;
        await cameras.UpdateAsync(camera, ct);

        // Regenerate Frigate config if the camera is active
        if (camera.IsEnabled && string.Equals(camera.ValidationState, "validated", StringComparison.OrdinalIgnoreCase))
        {
            var allCameras = await cameras.GetAllAsync(ct);
            await frigateConfigApplier.ApplyAsync(allCameras, ct);
        }

        return CameraDetectionConfigDto.From(camera);
    }
}
