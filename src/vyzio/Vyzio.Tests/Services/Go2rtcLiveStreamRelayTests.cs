using System.Net;
using System.Net.Sockets;
using System.Net.WebSockets;
using System.Text;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;
using Vyzio.Core.Entities;
using Vyzio.Infrastructure.Configuration;
using Vyzio.Infrastructure.Services;

namespace Vyzio.Tests.Services;

// Real sockets on the loopback: the verdict comes from what each end received, never from timing.
public sealed class Go2rtcLiveStreamRelayTests : IAsyncDisposable
{
    private readonly List<IDisposable> _owned = [];

    public ValueTask DisposeAsync()
    {
        foreach (var owned in _owned) owned.Dispose();
        return ValueTask.CompletedTask;
    }

    private sealed class FakeUpstream(WebSocket? socket, Task? connected = null) : ILiveStreamUpstream
    {
        public Uri? Requested { get; private set; }

        public async Task<WebSocket> ConnectAsync(Uri uri, CancellationToken ct)
        {
            Requested = uri;
            if (connected is not null) await connected;
            return socket ?? throw new WebSocketException("connection refused");
        }
    }

    private async Task<(WebSocket Near, WebSocket Far)> PairAsync()
    {
        var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var client = new TcpClient();
        var connecting = client.ConnectAsync(IPAddress.Loopback, ((IPEndPoint)listener.LocalEndpoint).Port);
        var server = await listener.AcceptTcpClientAsync();
        await connecting;
        listener.Stop();
        _owned.Add(client);
        _owned.Add(server);
        return (WebSocket.CreateFromStream(server.GetStream(), true, null, Timeout.InfiniteTimeSpan),
                WebSocket.CreateFromStream(client.GetStream(), false, null, Timeout.InfiniteTimeSpan));
    }

    private static Camera MakeCamera()
    {
        var camera = new Camera
        {
            Slug = "front-door",
            DisplayName = "Front door",
            Host = "192.168.1.10",
            Username = "viewer",
            Password = "s3cr#t",
            IsEnabled = true,
            ValidationState = CameraValidationState.Validated,
            FrigateCameraName = "front_door",
        }.WithStream(SupportedProtocol.Rtsp, path: "/stream1");
        StreamLineup.Add(camera.StreamBinding!, SupportedProtocol.Rtsp, "/stream2", StreamRole.Detect);
        return camera;
    }

    private static Go2rtcLiveStreamRelay MakeRelay(FakeUpstream upstream) => new(
        new VyzioRuntimeSettings(),
        NullLogger<Go2rtcLiveStreamRelay>.Instance,
        upstream,
        new FakeTimeProvider());

    private static async Task<(WebSocketMessageType Type, byte[] Bytes)> ReceiveAsync(WebSocket socket)
    {
        var buffer = new byte[4096];
        var result = await socket.ReceiveAsync(buffer, CancellationToken.None);
        return (result.MessageType, buffer[..result.Count]);
    }

    // go2rtc hangs up, and the browser answers the close the relay passes on.
    private static async Task EndFromGo2rtcAsync(WebSocket go2rtc, WebSocket browser, Task relaying)
    {
        await go2rtc.CloseOutputAsync(WebSocketCloseStatus.NormalClosure, null, CancellationToken.None);
        await ReceiveAsync(browser);
        await browser.CloseOutputAsync(WebSocketCloseStatus.NormalClosure, null, CancellationToken.None);
        await relaying;
    }

    [Theory]
    [InlineData(LiveQuality.Low, "ws://frigate:5000/live/mse/api/ws?src=front_door_1")] // nosemgrep: javascript.lang.security.detect-insecure-websocket.detect-insecure-websocket -- Frigate's internal port, inside the Docker network
    [InlineData(LiveQuality.High, "ws://frigate:5000/live/mse/api/ws?src=front_door")] // nosemgrep: javascript.lang.security.detect-insecure-websocket.detect-insecure-websocket -- Frigate's internal port, inside the Docker network
    public async Task RelayAsync_ShouldAskGo2rtcForTheQualitysStream_WhenTheViewerOpens(LiveQuality quality, string expected)
    {
        // Arrange
        var (viewer, browser) = await PairAsync();
        var (go2rtc, relaySide) = await PairAsync();
        var upstream = new FakeUpstream(relaySide);

        // Act
        await EndFromGo2rtcAsync(go2rtc, browser, MakeRelay(upstream).RelayAsync(MakeCamera(), quality, viewer));

        // Assert
        Assert.Equal(new Uri(expected), upstream.Requested);
    }

    [Fact]
    public async Task RelayAsync_ShouldPassFramesBothWays_WhenTheStreamIsOpen()
    {
        // Arrange
        var (viewer, browser) = await PairAsync();
        var (go2rtc, relaySide) = await PairAsync();
        var relaying = MakeRelay(new FakeUpstream(relaySide)).RelayAsync(MakeCamera(), LiveQuality.Low, viewer);

        // Act
        await browser.SendAsync(Encoding.UTF8.GetBytes("{\"type\":\"mse\"}"), WebSocketMessageType.Text, true, CancellationToken.None);
        var asked = await ReceiveAsync(go2rtc);
        await go2rtc.SendAsync(new byte[] { 0, 1, 2, 3 }, WebSocketMessageType.Binary, true, CancellationToken.None);
        var segment = await ReceiveAsync(browser);

        // Assert
        Assert.Equal("{\"type\":\"mse\"}", Encoding.UTF8.GetString(asked.Bytes));
        Assert.Equal(WebSocketMessageType.Binary, segment.Type);
        Assert.Equal(new byte[] { 0, 1, 2, 3 }, segment.Bytes);
        await EndFromGo2rtcAsync(go2rtc, browser, relaying);
    }

    [Fact]
    public async Task RelayAsync_ShouldRemoveTheCameraAccount_WhenGo2rtcReportsAnErrorNamingItsSource()
    {
        // Arrange
        var (viewer, browser) = await PairAsync();
        var (go2rtc, relaySide) = await PairAsync();
        var relaying = MakeRelay(new FakeUpstream(relaySide)).RelayAsync(MakeCamera(), LiveQuality.Low, viewer);
        var error = "{\"type\":\"error\",\"value\":\"streams: parse rtsp://viewer:s3cr%23t@192.168.1.10:554/stream2 and s3cr#t\"}";

        // Act
        await go2rtc.SendAsync(Encoding.UTF8.GetBytes(error), WebSocketMessageType.Text, true, CancellationToken.None);
        var received = Encoding.UTF8.GetString((await ReceiveAsync(browser)).Bytes);

        // Assert
        Assert.DoesNotContain("s3cr", received, StringComparison.Ordinal);
        Assert.DoesNotContain("viewer", received, StringComparison.Ordinal);
        Assert.Contains("192.168.1.10:554/stream2", received, StringComparison.Ordinal);
        await EndFromGo2rtcAsync(go2rtc, browser, relaying);
    }

    [Fact]
    public async Task RelayAsync_ShouldCloseWithTheUnreachableCode_WhenGo2rtcCannotBeReached()
    {
        // Arrange
        var (viewer, browser) = await PairAsync();

        // Act
        await MakeRelay(new FakeUpstream(null)).RelayAsync(MakeCamera(), LiveQuality.Low, viewer);
        var closing = await ReceiveAsync(browser);

        // Assert
        Assert.Equal(WebSocketMessageType.Close, closing.Type);
        Assert.Equal((WebSocketCloseStatus)LiveStreamClose.Unreachable, browser.CloseStatus);
    }

    [Fact]
    public async Task RelayAsync_ShouldCloseTheGo2rtcSocket_WhenTheViewerLeaves()
    {
        // Arrange
        var (viewer, browser) = await PairAsync();
        var (go2rtc, relaySide) = await PairAsync();
        var relaying = MakeRelay(new FakeUpstream(relaySide)).RelayAsync(MakeCamera(), LiveQuality.Low, viewer);

        // Act
        await browser.CloseOutputAsync(WebSocketCloseStatus.NormalClosure, null, CancellationToken.None);
        var closing = await ReceiveAsync(go2rtc);
        await go2rtc.CloseOutputAsync(WebSocketCloseStatus.NormalClosure, null, CancellationToken.None);
        await relaying;

        // Assert
        Assert.Equal(WebSocketMessageType.Close, closing.Type);
        Assert.Equal(WebSocketCloseStatus.NormalClosure, go2rtc.CloseStatus);
    }

    [Fact]
    public async Task Cut_ShouldCloseTheViewerWithThePrivacyCode_WhenTheCameraIsStreaming()
    {
        // Arrange
        var (viewer, browser) = await PairAsync();
        var (go2rtc, relaySide) = await PairAsync();
        var camera = MakeCamera();
        var relay = MakeRelay(new FakeUpstream(relaySide));
        var relaying = relay.RelayAsync(camera, LiveQuality.Low, viewer);
        await browser.SendAsync(Encoding.UTF8.GetBytes("{}"), WebSocketMessageType.Text, true, CancellationToken.None);
        await ReceiveAsync(go2rtc);

        // Act
        relay.Cut(camera.Id);
        var closing = await ReceiveAsync(browser);
        await browser.CloseOutputAsync(WebSocketCloseStatus.NormalClosure, null, CancellationToken.None);
        await relaying;

        // Assert
        Assert.Equal(WebSocketMessageType.Close, closing.Type);
        Assert.Equal((WebSocketCloseStatus)LiveStreamClose.PrivacyMode, browser.CloseStatus);
    }

    [Fact]
    public async Task Cut_ShouldCloseTheViewerWithThePrivacyCode_WhenGo2rtcAnswersAfterTheCut()
    {
        // Arrange
        var (viewer, browser) = await PairAsync();
        var (_, relaySide) = await PairAsync();
        var answer = new TaskCompletionSource();
        var camera = MakeCamera();
        var relay = MakeRelay(new FakeUpstream(relaySide, answer.Task));
        var relaying = relay.RelayAsync(camera, LiveQuality.Low, viewer);

        // Act
        relay.Cut(camera.Id);
        answer.SetResult();
        var closing = await ReceiveAsync(browser);
        await browser.CloseOutputAsync(WebSocketCloseStatus.NormalClosure, null, CancellationToken.None);
        await relaying;

        // Assert
        Assert.Equal(WebSocketMessageType.Close, closing.Type);
        Assert.Equal((WebSocketCloseStatus)LiveStreamClose.PrivacyMode, browser.CloseStatus);
    }
}
