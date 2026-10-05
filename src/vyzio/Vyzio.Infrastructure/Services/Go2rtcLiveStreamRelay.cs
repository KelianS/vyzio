using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;
using Vyzio.Core.Common;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.Configuration;

namespace Vyzio.Infrastructure.Services;

internal interface ILiveStreamUpstream
{
    Task<WebSocket> ConnectAsync(Uri uri, CancellationToken ct);
}

internal sealed class ClientWebSocketUpstream : ILiveStreamUpstream
{
    public async Task<WebSocket> ConnectAsync(Uri uri, CancellationToken ct)
    {
        var socket = new ClientWebSocket();
        try
        {
            await socket.ConnectAsync(uri, ct);
            return socket;
        }
        catch
        {
            socket.Dispose();
            throw;
        }
    }
}

// Copies frames both ways between the viewer and go2rtc's MSE socket, reading only go2rtc's text messages to scrub them (ADR-72 b).
public sealed partial class Go2rtcLiveStreamRelay : ILiveStreamRelay
{
    private const int BufferSize = 64 * 1024;
    private static readonly TimeSpan CloseGrace = TimeSpan.FromSeconds(5);

    private readonly VyzioRuntimeSettings settings;
    private readonly ILogger<Go2rtcLiveStreamRelay> logger;
    private readonly ILiveStreamUpstream upstream;
    private readonly TimeProvider time;
    private readonly ConcurrentDictionary<Session, byte> sessions = new();

    // Registered before go2rtc answers, so a cut during the connection is not missed.
    private sealed class Session(string cameraId)
    {
        private readonly Lock gate = new();
        private WebSocket? source;

        public string CameraId { get; } = cameraId;
        public bool Cut { get; private set; }

        // Either the cut finds the source and aborts it, or the source arrives already cut and is aborted.
        public void Attach(WebSocket connected)
        {
            lock (gate)
            {
                source = connected;
                if (Cut) connected.Abort();
            }
        }

        public void CutNow()
        {
            lock (gate)
            {
                Cut = true;
                source?.Abort();
            }
        }
    }

    public Go2rtcLiveStreamRelay(VyzioRuntimeSettings settings, ILogger<Go2rtcLiveStreamRelay> logger, TimeProvider time)
        : this(settings, logger, new ClientWebSocketUpstream(), time)
    {
    }

    internal Go2rtcLiveStreamRelay(VyzioRuntimeSettings settings, ILogger<Go2rtcLiveStreamRelay> logger, ILiveStreamUpstream upstream, TimeProvider time)
    {
        this.settings = settings;
        this.logger = logger;
        this.upstream = upstream;
        this.time = time;
    }

    public async Task RelayAsync(Camera camera, LiveQuality quality, WebSocket viewer, CancellationToken ct = default)
    {
        var name = Go2rtcStreams.Name(camera.FrigateCameraName, camera.LiveStream(quality));

        var session = new Session(camera.Id);
        sessions.TryAdd(session, 0);
        try
        {
            await RelayFromAsync(session, name, camera, viewer, ct);
        }
        finally
        {
            sessions.TryRemove(session, out _);
        }

        if (session.Cut) logger.LogInformation("Live stream {Stream} cut for privacy mode", name);
    }

    private async Task RelayFromAsync(Session session, string name, Camera camera, WebSocket viewer, CancellationToken ct)
    {
        WebSocket source;
        try
        {
            source = await upstream.ConnectAsync(StreamUri(name), ct);
        }
        catch (Exception ex) when (ex is WebSocketException or HttpRequestException or IOException)
        {
            logger.LogWarning(ex, "Live stream {Stream} could not be opened", name);
            await CloseQuietlyAsync(viewer, (WebSocketCloseStatus)LiveStreamClose.Unreachable, "stream_unreachable");
            return;
        }

        session.Attach(source);
        using (source)
        {
            var scrub = Scrubber(camera);
            var toCamera = PumpAsync(viewer, source, null, logger, ct);
            var toViewer = PumpAsync(source, viewer, scrub, logger, ct);

            // The side that ended first has its close passed on; the other answers it, or is cut after a grace.
            var first = await Task.WhenAny(toCamera, toViewer);
            var (status, description) = session.Cut
                ? ((WebSocketCloseStatus)LiveStreamClose.PrivacyMode, SnakeCaseEnum.ToSnakeCase(LiveStreamClose.PrivacyMode))
                : await first;
            var (ended, other, otherPump) = first == toViewer ? (source, viewer, toCamera) : (viewer, source, toViewer);

            await CloseQuietlyAsync(other, status ?? WebSocketCloseStatus.EndpointUnavailable, description);
            if (await Task.WhenAny(otherPump, Task.Delay(CloseGrace, time, CancellationToken.None)) != otherPump)
                other.Abort();
            await CloseQuietlyAsync(ended, status ?? WebSocketCloseStatus.EndpointUnavailable, description);
        }
    }

    // Aborting go2rtc's side ends its pump; the relay then closes the viewer with the privacy code.
    public void Cut(string cameraId)
    {
        foreach (var session in sessions.Keys.Where(session => session.CameraId == cameraId))
        {
            session.CutNow();
        }
    }

    private Uri StreamUri(string name)
    {
        var baseUri = new Uri(settings.Frigate.ApiBaseUrl);
        var scheme = baseUri.Scheme == Uri.UriSchemeHttps ? "wss" : "ws";
        return new Uri($"{scheme}://{baseUri.Authority}/live/mse/api/ws?src={Uri.EscapeDataString(name)}");
    }

    // Returns how the source closed, or null when it vanished without a close.
    private static async Task<(WebSocketCloseStatus? Status, string? Description)> PumpAsync(
        WebSocket from, WebSocket to, Func<string, string>? scrubText, ILogger logger, CancellationToken ct)
    {
        var buffer = new byte[BufferSize];
        using var text = new MemoryStream();
        try
        {
            while (true)
            {
                var received = await from.ReceiveAsync(buffer, ct);
                if (received.MessageType == WebSocketMessageType.Close)
                    return (from.CloseStatus, from.CloseStatusDescription);

                if (received.MessageType == WebSocketMessageType.Text && scrubText is not null)
                {
                    text.Write(buffer, 0, received.Count);
                    if (!received.EndOfMessage) continue;

                    var scrubbed = scrubText(Encoding.UTF8.GetString(text.GetBuffer(), 0, (int)text.Length));
                    text.SetLength(0);
                    await to.SendAsync(Encoding.UTF8.GetBytes(scrubbed), WebSocketMessageType.Text, true, ct);
                    continue;
                }

                await to.SendAsync(buffer.AsMemory(0, received.Count), received.MessageType, received.EndOfMessage, ct);
            }
        }
        catch (Exception ex) when (ex is WebSocketException or OperationCanceledException or IOException)
        {
            logger.LogDebug(ex, "Live relay side ended without a close");
            return (null, null);
        }
    }

    // go2rtc names the source URL in its errors, camera account included.
    internal static Func<string, string> Scrubber(Camera camera)
    {
        var secrets = Enum.GetValues<SupportedProtocol>()
            .Select(camera.CredentialsFor)
            .SelectMany(account => new[] { account.Username, account.Password })
            .Where(secret => !string.IsNullOrEmpty(secret))
            .SelectMany(secret => new[] { secret!, Uri.EscapeDataString(secret!) })
            .Distinct()
            .OrderByDescending(secret => secret.Length)
            .ToList();

        return message =>
        {
            var scrubbed = UserInfo().Replace(message, "://");
            foreach (var secret in secrets)
                scrubbed = scrubbed.Replace(secret, "***", StringComparison.Ordinal);
            return scrubbed;
        };
    }

    private static async Task CloseQuietlyAsync(WebSocket socket, WebSocketCloseStatus status, string? description)
    {
        if (socket.State is not (WebSocketState.Open or WebSocketState.CloseReceived)) return;
        try
        {
            await socket.CloseOutputAsync(status, description, CancellationToken.None);
        }
        catch (Exception ex) when (ex is WebSocketException or IOException or ObjectDisposedException)
        {
            // Already gone: nothing left to tell it.
        }
    }

    [GeneratedRegex(@"://[^\s""/@]*@")]
    private static partial Regex UserInfo();
}
