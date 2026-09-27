using System.Net;
using System.Net.Sockets;
using System.Text;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;
using NSubstitute;
using Vyzio.Core.Entities;
using Vyzio.Infrastructure.CapabilityProviders;
using Vyzio.Infrastructure.Services;
using Vyzio.Infrastructure.VendorAdapters;
using Vyzio.Tests.Services.Hosting;

namespace Vyzio.Tests.Services;

// The protocol level: reach, then login with the protocol's account (ADR-61). Capabilities are tested on their bindings, elsewhere.
// The clock stays still: the verdict comes from what the peer answered, not from how fast.
public sealed class CameraProtocolProbeTests
{
    private static CameraProtocolProbe MakeProbe(HttpMessageHandler? http = null)
    {
        var handler = http ?? new StatusHandler(HttpStatusCode.NotFound);
        var factory = Substitute.For<IHttpClientFactory>();
        factory.CreateClient(Arg.Any<string>()).Returns(_ => new HttpClient(handler, disposeHandler: false));
        var resolver = new OnvifEndpointResolver(factory, TimeProvider.System, NullLogger<OnvifEndpointResolver>.Instance);
        var onvif = new OnvifClient(factory, resolver, TimeProvider.System, NullLogger<OnvifClient>.Instance);
        return new CameraProtocolProbe(
            resolver,
            onvif,
            new DvripClient(TimeProvider.System),
            new V380Client(NullLogger<V380Client>.Instance),
            new TapoKlapProvider(factory, new PtzMoveRunner(TimeProvider.System, NullLogger<PtzMoveRunner>.Instance), NullLogger<TapoKlapProvider>.Instance),
            new FakeTimeProvider(),
            NullLogger<CameraProtocolProbe>.Instance);
    }

    private static Camera CameraOn(SupportedProtocol protocol, int port, string? username = null)
    {
        var camera = new Camera
        {
            Id = "cam1",
            Slug = "cam1",
            FrigateCameraName = "cam1",
            DisplayName = "cam1",
            Host = "127.0.0.1",
            Username = username,
            Password = username is null ? null : "test-password",
        };
        camera.EnsureProtocol(protocol).Port = port;
        return camera;
    }

    private static int PortOf(TcpListener listener) => ((IPEndPoint)listener.LocalEndpoint).Port;

    // Lets the reach dial through, then answers each request of the login connection with the next line of the script.
    private static Task ServeAsync(TcpListener listener, params string[] answers) => Task.Run(async () =>
    {
        using (await listener.AcceptTcpClientAsync()) { }
        using var client = await listener.AcceptTcpClientAsync();
        var stream = client.GetStream();
        var buffer = new byte[4096];
        foreach (var answer in answers)
        {
            if (await stream.ReadAsync(buffer) <= 0) return;
            await stream.WriteAsync(Encoding.ASCII.GetBytes(answer));
        }
    });

    // Reach: the protocol's port is dialled first; a login never runs on a silent protocol.

    [Fact]
    public async Task ProbeAsync_ShouldBeUnreachableNamingTheProtocolAndPort_WhenThePortRefusesTheConnection()
    {
        // Arrange
        using var refusing = BackgroundLoop.RefusingPort();
        var port = refusing.PortOf();

        // Act
        var answer = await MakeProbe().ProbeAsync(CameraOn(SupportedProtocol.Dvrip, port), SupportedProtocol.Dvrip).ObservedAsync();

        // Assert
        Assert.Equal(ProtocolStatus.Unreachable, answer.Status);
        Assert.Contains($"Dvrip: 127.0.0.1:{port}", answer.Error, StringComparison.Ordinal);
    }

    [Fact]
    public async Task ProbeAsync_ShouldBeUnreachable_WhenNoOnvifDeviceServiceIsFound()
    {
        // Arrange
        var camera = CameraOn(SupportedProtocol.Onvif, 1);

        // Act
        var answer = await MakeProbe().ProbeAsync(camera, SupportedProtocol.Onvif).ObservedAsync();

        // Assert
        Assert.Equal(ProtocolStatus.Unreachable, answer.Status);
        Assert.Equal("No ONVIF service answered on 127.0.0.1.", answer.Error);
    }

    // Login, ONVIF: one read of the device service, with the ONVIF account.

    [Theory]
    [InlineData(HttpStatusCode.OK, ProtocolStatus.Answers)]
    [InlineData(HttpStatusCode.Unauthorized, ProtocolStatus.Refused)]
    public async Task ProbeAsync_ShouldFollowTheDeviceServiceAnswer_WhenOnvifIsFound(HttpStatusCode deviceInformation, ProtocolStatus expected)
    {
        // Arrange
        var camera = CameraOn(SupportedProtocol.Onvif, 2020, username: "viewer");

        // Act
        var answer = await MakeProbe(new OnvifHandler(deviceInformation)).ProbeAsync(camera, SupportedProtocol.Onvif).ObservedAsync();

        // Assert
        Assert.Equal(expected, answer.Status);
    }

    // Login, RTSP: DESCRIBE, then again with the account when the camera challenges.

    [Fact]
    public async Task ProbeAsync_ShouldAnswer_WhenTheRtspServiceAsksForNoAccount()
    {
        // Arrange
        using var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var camera = CameraOn(SupportedProtocol.Rtsp, PortOf(listener));
        var server = ServeAsync(listener, "RTSP/1.0 200 OK\r\nCSeq: 1\r\n\r\n");

        // Act
        var answer = await MakeProbe().ProbeAsync(camera, SupportedProtocol.Rtsp).ObservedAsync();

        // Assert
        await server;
        Assert.Equal(ProtocolStatus.Answers, answer.Status);
    }

    [Fact]
    public async Task ProbeAsync_ShouldAnswer_WhenTheRtspServiceAcceptsTheDigestAccount()
    {
        // Arrange
        using var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var camera = CameraOn(SupportedProtocol.Rtsp, PortOf(listener), username: "viewer");
        var server = ServeAsync(listener,
            "RTSP/1.0 401 Unauthorized\r\nCSeq: 1\r\nWWW-Authenticate: Digest realm=\"cam\", nonce=\"abc\"\r\n\r\n",
            "RTSP/1.0 200 OK\r\nCSeq: 2\r\n\r\n");

        // Act
        var answer = await MakeProbe().ProbeAsync(camera, SupportedProtocol.Rtsp).ObservedAsync();

        // Assert
        await server;
        Assert.Equal(ProtocolStatus.Answers, answer.Status);
    }

    [Fact]
    public async Task ProbeAsync_ShouldBeRefused_WhenTheRtspServiceTurnsTheAccountDown()
    {
        // Arrange
        using var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var camera = CameraOn(SupportedProtocol.Rtsp, PortOf(listener), username: "viewer");
        var server = ServeAsync(listener,
            "RTSP/1.0 401 Unauthorized\r\nCSeq: 1\r\nWWW-Authenticate: Basic realm=\"cam\"\r\n\r\n",
            "RTSP/1.0 401 Unauthorized\r\nCSeq: 2\r\n\r\n");

        // Act
        var answer = await MakeProbe().ProbeAsync(camera, SupportedProtocol.Rtsp).ObservedAsync();

        // Assert
        await server;
        Assert.Equal(ProtocolStatus.Refused, answer.Status);
        Assert.DoesNotContain("test-password", answer.Error, StringComparison.Ordinal);
    }

    [Fact]
    public async Task ProbeAsync_ShouldBeRefused_WhenTheRtspServiceAsksForAnAccountAndNoneIsSet()
    {
        // Arrange
        using var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var camera = CameraOn(SupportedProtocol.Rtsp, PortOf(listener));
        var server = ServeAsync(listener, "RTSP/1.0 401 Unauthorized\r\nCSeq: 1\r\nWWW-Authenticate: Basic realm=\"cam\"\r\n\r\n");

        // Act
        var answer = await MakeProbe().ProbeAsync(camera, SupportedProtocol.Rtsp).ObservedAsync();

        // Assert
        await server;
        Assert.Equal(ProtocolStatus.Refused, answer.Status);
    }

    // Login, DVRIP: the login packet, with the DVRIP account.

    [Theory]
    [InlineData(100, ProtocolStatus.Answers)]
    [InlineData(203, ProtocolStatus.Refused)]
    public async Task ProbeAsync_ShouldFollowTheLoginReturnCode_WhenTheDvripServiceAnswersTheLogin(int ret, ProtocolStatus expected)
    {
        // Arrange
        using var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var camera = CameraOn(SupportedProtocol.Dvrip, PortOf(listener), username: "viewer");
        var server = Task.Run(async () =>
        {
            // The reach dial comes first and closes at once; the login is the second connection.
            using (await listener.AcceptTcpClientAsync()) { }
            using var client = await listener.AcceptTcpClientAsync();
            var stream = client.GetStream();
            await DvripClient.ReceivePacketAsync(stream, CancellationToken.None);
            await DvripClient.SendPacketAsync(stream, 1001, $"{{\"Ret\":{ret},\"SessionID\":\"0x00000001\"}}", 0, "0x00000001", CancellationToken.None);
        });

        // Act
        var answer = await MakeProbe().ProbeAsync(camera, SupportedProtocol.Dvrip).ObservedAsync();

        // Assert
        await server;
        Assert.Equal(expected, answer.Status);
    }

    // Login, V380: the auth handshake with the account and the device number.

    [Fact]
    public async Task ProbeAsync_ShouldBeRefused_WhenTheV380ServiceGivesNoTicket()
    {
        // Arrange
        using var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var camera = CameraOn(SupportedProtocol.V380, PortOf(listener), username: "viewer");
        camera.Protocol(SupportedProtocol.V380)!.DeviceId = 12345678;
        var server = Task.Run(async () =>
        {
            using (await listener.AcceptTcpClientAsync()) { }
            using var client = await listener.AcceptTcpClientAsync();
            var stream = client.GetStream();
            await stream.ReadExactlyAsync(new byte[256]);
            await stream.WriteAsync(new byte[256]);
        });

        // Act
        var answer = await MakeProbe().ProbeAsync(camera, SupportedProtocol.V380).ObservedAsync();

        // Assert
        await server;
        Assert.Equal(ProtocolStatus.Refused, answer.Status);
        Assert.Contains("12345678", answer.Error, StringComparison.Ordinal);
    }

    // Login, Tapo KLAP: the handshake with the KLAP account.

    [Fact]
    public async Task ProbeAsync_ShouldBeRefused_WhenTheKlapHandshakeIsTurnedDown()
    {
        // Arrange
        using var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var camera = CameraOn(SupportedProtocol.TapoKlap, PortOf(listener), username: "viewer");

        // Act
        var answer = await MakeProbe(new StatusHandler(HttpStatusCode.Forbidden)).ProbeAsync(camera, SupportedProtocol.TapoKlap).ObservedAsync();

        // Assert
        Assert.Equal(ProtocolStatus.Refused, answer.Status);
    }

    // Answers ONVIF's unauthenticated probes, and GetDeviceInformation with the status under test.
    private sealed class OnvifHandler(HttpStatusCode deviceInformation) : HttpMessageHandler
    {
        private const string DateAndTime = """
            <s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope">
              <s:Body><GetSystemDateAndTimeResponse xmlns="http://www.onvif.org/ver10/device/wsdl"/></s:Body>
            </s:Envelope>
            """;

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var body = request.Content is null ? string.Empty : await request.Content.ReadAsStringAsync(cancellationToken);
            var status = body.Contains("GetDeviceInformation", StringComparison.Ordinal) ? deviceInformation : HttpStatusCode.OK;
            return new HttpResponseMessage(status) { Content = new StringContent(DateAndTime, Encoding.UTF8, "application/soap+xml") };
        }
    }

    [Fact]
    public async Task ProbeAsync_ShouldBeUnreachableNamingTheFailure_WhenALoginFailsInAWayNoCheckKnows()
    {
        // Arrange
        using var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var camera = CameraOn(SupportedProtocol.TapoKlap, PortOf(listener), username: "viewer");

        // Act
        var answer = await MakeProbe(new ThrowingHandler()).ProbeAsync(camera, SupportedProtocol.TapoKlap).ObservedAsync();

        // Assert
        Assert.Equal(ProtocolStatus.Unreachable, answer.Status);
        Assert.Contains("InvalidOperationException", answer.Error, StringComparison.Ordinal);
    }

    private sealed class ThrowingHandler : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            => throw new InvalidOperationException("handler broke");
    }

    private sealed class StatusHandler(HttpStatusCode status) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            => Task.FromResult(new HttpResponseMessage(status));
    }
}
