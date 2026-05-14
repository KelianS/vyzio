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
        if (string.Equals(camera.ValidationState, "pending_removal", StringComparison.OrdinalIgnoreCase))
        {
            return "Suppression en attente. Appliquez la configuration pour finaliser le retrait dans Frigate.";
        }

        if (string.Equals(camera.ValidationState, "draft", StringComparison.OrdinalIgnoreCase))
        {
            if (string.IsNullOrWhiteSpace(camera.StreamPath))
            {
                return "Configuration incomplete. Ajoutez le chemin RTSP, puis lancez la verification.";
            }

            return "Configuration incomplete. Verifiez le flux avant d'appliquer la configuration.";
        }

        if (string.Equals(camera.Status, "config_error", StringComparison.OrdinalIgnoreCase))
        {
            return "Frigate n'a pas pu appliquer la configuration generee pour cette camera.";
        }

        if (string.Equals(camera.Status, "degraded", StringComparison.OrdinalIgnoreCase))
        {
            return "La camera repond sur le reseau, mais le flux n'a pas pu etre confirme.";
        }

        if (!connected)
        {
            return "Camera injoignable. Verifiez l'acces reseau et les parametres du flux.";
        }

        if (!previewAvailable)
        {
            return "Camera connectee, mais aucun apercu recent n'est encore disponible.";
        }

        return "Camera connectee et prete.";
    }
}