using Vyzio.Core.Entities;

namespace Vyzio.Application.DTOs.Cameras;

public sealed record CameraStatusDto(
    string CameraId,
    string DisplayName,
    string Status,
    string ValidationState,
    bool Connected,
    bool PreviewAvailable,
    bool NeedsAttention,
    string? Guidance,
    DateTimeOffset? LastReachabilityCheckAt,
    DateTimeOffset? LastSuccessfulFrameAt)
{
    public static CameraStatusDto From(Camera camera, string? guidanceOverride = null)
    {
        var connected = string.Equals(camera.Status, "online", StringComparison.OrdinalIgnoreCase);
        var previewAvailable = camera.LastSuccessfulFrameAt.HasValue;
        var needsAttention = !connected || !camera.IsEnabled || string.Equals(camera.ValidationState, "draft", StringComparison.OrdinalIgnoreCase);

        return new CameraStatusDto(
            camera.Id,
            camera.DisplayName,
            camera.Status,
            camera.ValidationState,
            connected,
            previewAvailable,
            needsAttention,
                guidanceOverride ?? BuildGuidance(camera, connected, previewAvailable),
            camera.LastReachabilityCheckAt,
            camera.LastSuccessfulFrameAt);
    }

    private static string? BuildGuidance(Camera camera, bool connected, bool previewAvailable)
    {
        if (string.Equals(camera.ValidationState, "draft", StringComparison.OrdinalIgnoreCase))
        {
            return "Camera setup is incomplete.";
        }

        if (string.Equals(camera.Status, "config_error", StringComparison.OrdinalIgnoreCase))
        {
            return "Frigate could not apply the generated camera configuration.";
        }

        if (string.Equals(camera.Status, "degraded", StringComparison.OrdinalIgnoreCase))
        {
            return "Camera network endpoint is reachable, but the stream preview could not be confirmed.";
        }

        if (!connected)
        {
            return "Camera is unreachable. Check network access and stream settings.";
        }

        if (!previewAvailable)
        {
            return "Camera is connected but no recent preview is available yet.";
        }

        return "Camera is connected and ready.";
    }
}