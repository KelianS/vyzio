using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Cameras;

/// <summary>
/// Finds the Vyzio camera behind a Frigate camera name.
/// Scoped: the list below is cached for one request or one ingested message, never longer.
/// </summary>
public sealed class CameraDirectory(ICameraRepository cameras)
{
    private IReadOnlyList<Camera>? _cameras;

    public async Task<Camera?> FindByFrigateNameAsync(string frigateName, CancellationToken ct = default)
    {
        _cameras ??= await cameras.GetAllAsync(ct);
        return _cameras.FirstOrDefault(camera =>
            string.Equals(camera.FrigateName, frigateName, StringComparison.Ordinal));
    }
}
