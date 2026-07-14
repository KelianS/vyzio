using System.Collections.Concurrent;

namespace Vyzio.Infrastructure.CapabilityProviders;

// Singleton session-level store for virtual PTZ positions (ADR-25 Branch B).
// Injected into V380PtzProvider (Scoped) via Singleton lifetime — survives across HTTP requests.
// State is lost on service restart; acceptable because homing re-establishes (0,0) on demand.
internal sealed class V380PtzPositionTracker
{
    private readonly ConcurrentDictionary<string, (int X, int Y)> _positions = new();

    public (int X, int Y)? Get(string cameraId)
        => _positions.TryGetValue(cameraId, out var pos) ? pos : null;

    public void Set(string cameraId, int x, int y)
        => _positions[cameraId] = (x, y);

    public bool TryGet(string cameraId, out (int X, int Y) pos)
        => _positions.TryGetValue(cameraId, out pos);

    public void Update(string cameraId, int dx, int dy)
    {
        _positions.AddOrUpdate(cameraId, (dx, dy), (_, old) => (old.X + dx, old.Y + dy));
    }
}
