using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Cameras;

// Why a live stream is not opened, each closing the socket with its own code (ADR-72 b).
public enum LiveStreamRefusal
{
    UnknownCamera,
    PrivacyMode,
    NoStream,
}

public sealed record LiveStreamOpening(Camera? Camera, LiveStreamRefusal? Refusal)
{
    public static LiveStreamOpening Refused(LiveStreamRefusal refusal) => new(null, refusal);
}

public sealed class OpenLiveStreamUseCase(ICameraRepository cameras)
{
    public async Task<LiveStreamOpening> ExecuteAsync(string id, LiveQuality quality, CancellationToken ct = default)
    {
        var camera = await cameras.GetByIdAsync(id, ct);
        if (camera is null) return LiveStreamOpening.Refused(LiveStreamRefusal.UnknownCamera);
        if (camera.PrivacyModeActive) return LiveStreamOpening.Refused(LiveStreamRefusal.PrivacyMode);
        if (!camera.LiveQualities.Contains(quality)) return LiveStreamOpening.Refused(LiveStreamRefusal.NoStream);
        return new LiveStreamOpening(camera, null);
    }
}
