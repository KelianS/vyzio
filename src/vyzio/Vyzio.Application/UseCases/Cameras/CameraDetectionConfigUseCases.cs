using System.Text.Json;
using Vyzio.Application.DTOs.Cameras;
using Vyzio.Core.Common;
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
    IFrigateConfigApplier frigateConfigApplier,
    IFrigateMotionSettingsPublisher motionSettingsPublisher)
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

        var sensitivityChanged = ApplySensitivity(camera, request);
        ApplyDetectStream(camera, request);

        camera.UpdatedAt = DateTimeOffset.UtcNow;
        await cameras.UpdateAsync(camera, ct);

        var isLive = camera.IsEnabled
            && string.Equals(camera.ValidationState, "validated", StringComparison.OrdinalIgnoreCase);

        if (isLive)
        {
            var allCameras = await cameras.GetAllAsync(ct);
            await frigateConfigApplier.WriteConfigAsync(allCameras, ct);

            // Writing the config alone would only take effect on the next Frigate restart; the
            // runtime command makes a user-chosen level apply straight away (ADR-35).
            if (sensitivityChanged && !string.IsNullOrWhiteSpace(camera.FrigateCameraName))
            {
                await motionSettingsPublisher.TryPublishSensitivityAsync(
                    camera.FrigateCameraName, camera.MotionSensitivity, ct);
            }
        }

        return CameraDetectionConfigDto.From(camera);
    }

    // Returns whether the effective level changed. An unrecognised value is ignored rather than
    // rejected: the level is a hint the loop would overwrite anyway, never a reason to fail a save
    // that also carries the user's detection labels.
    private static bool ApplySensitivity(Camera camera, SaveCameraDetectionConfigRequest request)
    {
        camera.MotionSensitivityPinned = request.MotionSensitivityPinned;

        if (!request.MotionSensitivityPinned || request.MotionSensitivity is null)
            return false;

        if (!SnakeCaseEnum.TryFromSnakeCase<MotionSensitivity>(request.MotionSensitivity, out var level))
            return false;

        if (camera.MotionSensitivity == level)
            return false;

        camera.MotionSensitivity = level;
        return true;
    }

    // An id that matches no stream of this camera is discarded rather than stored: the fallback to
    // the main stream must come from an absent choice, never from a dangling one that would silently
    // survive a re-enumeration (ADR-38).
    private static void ApplyDetectStream(Camera camera, SaveCameraDetectionConfigRequest request)
    {
        camera.DetectStreamId = camera.Streams.Any(stream => stream.Id == request.DetectStreamId)
            ? request.DetectStreamId
            : null;
    }
}
