using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.VendorAdapters;

// Fallback adapter for cameras with no known vendor API.
// Privacy mode falls back to Frigate config only (enabled: false).
public sealed class NullVendorCameraAdapter : IVendorCameraAdapter
{
    public string VendorFamily => "generic";

    public Task<bool> SupportsPrivacyModeAsync(Camera camera, CancellationToken ct = default)
        => Task.FromResult(false);

    public Task SetPrivacyModeAsync(Camera camera, bool active, CancellationToken ct = default)
        => Task.CompletedTask;

    public Task<bool> SupportsPtzAsync(Camera camera, CancellationToken ct = default)
        => Task.FromResult(false);

    public Task PtzMoveAsync(Camera camera, PtzDirection direction, int speed, CancellationToken ct = default)
        => Task.CompletedTask;

    public Task PtzStopAsync(Camera camera, CancellationToken ct = default)
        => Task.CompletedTask;

    public Task PtzGoToPresetAsync(Camera camera, int presetId, CancellationToken ct = default)
        => Task.CompletedTask;

    public Task PtzSavePresetAsync(Camera camera, int presetId, CancellationToken ct = default)
        => Task.CompletedTask;
}
