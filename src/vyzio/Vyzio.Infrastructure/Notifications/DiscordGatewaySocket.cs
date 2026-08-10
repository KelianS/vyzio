using System.Net.WebSockets;
using System.Text;

namespace Vyzio.Infrastructure.Notifications;

/// <summary>The web socket the Discord gateway needs, narrowed to what the loop uses — and to what a test can stand in for.</summary>
internal interface IDiscordGatewaySocket : IDisposable
{
    Task ConnectAsync(Uri uri, CancellationToken ct);

    Task SendAsync(string payload, CancellationToken ct);

    /// <summary>The next frame, or null once the other end is gone.</summary>
    Task<string?> ReceiveAsync(CancellationToken ct);
}

internal interface IDiscordGatewaySocketFactory
{
    IDiscordGatewaySocket Create();
}

internal sealed class ClientWebSocketFactory : IDiscordGatewaySocketFactory
{
    public IDiscordGatewaySocket Create() => new ClientWebSocketAdapter();
}

internal sealed class ClientWebSocketAdapter : IDiscordGatewaySocket
{
    private const int BufferSize = 8 * 1024;

    private readonly ClientWebSocket _socket = new();

    public Task ConnectAsync(Uri uri, CancellationToken ct) => _socket.ConnectAsync(uri, ct);

    public Task SendAsync(string payload, CancellationToken ct) => _socket.SendAsync(
        Encoding.UTF8.GetBytes(payload), WebSocketMessageType.Text, endOfMessage: true, ct);

    public async Task<string?> ReceiveAsync(CancellationToken ct)
    {
        var buffer = new byte[BufferSize];
        var frame = new StringBuilder();

        while (true)
        {
            var received = await _socket.ReceiveAsync(buffer, ct);
            if (received.MessageType == WebSocketMessageType.Close) return null;

            frame.Append(Encoding.UTF8.GetString(buffer, 0, received.Count));
            if (received.EndOfMessage) return frame.ToString();
        }
    }

    public void Dispose() => _socket.Dispose();
}
