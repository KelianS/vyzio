using System.Net.WebSockets;
using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

public interface ILiveStreamRelay
{
    /// <summary>
    /// Relays the viewer's socket to the camera's live stream until either side closes (ADR-07.
    /// </summary>
    Task RelayAsync(Camera camera, LiveQuality quality, WebSocket viewer, CancellationToken ct = default);

    /// <summary>
    /// Ends every live stream of the camera at once, closing the viewers with the privacy code (ADR-07.
    /// </summary>
    void Cut(string cameraId);
}
