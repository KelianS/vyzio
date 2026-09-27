using System.Net;
using System.Security.Cryptography;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;
using NSubstitute;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.CapabilityProviders;

namespace Vyzio.Tests.Services;

public class TapoKlapProviderTests
{
    private static readonly TimeSpan Tap = TimeSpan.FromMilliseconds(100);

    private static Camera MakeCamera() => new()
    {
        Id = "cam1",
        Slug = "cam1",
        FrigateCameraName = "cam1",
        DisplayName = "Tapo Cam",
        Host = "192.168.1.50",
        Port = 554,
        Username = "admin",
        Password = "secret",
    };

    private static CameraCapabilityBinding MakeBinding(CameraCapability capability) => new()
    {
        CameraId = "cam1",
        Capability = capability,
        Protocol = SupportedProtocol.TapoKlap,
        Verified = true,
    };

    private static TapoKlapProvider MakeProvider(HttpMessageHandler handler, TimeProvider? time = null)
    {
        var factory = Substitute.For<IHttpClientFactory>();
        factory.CreateClient("tapo").Returns(_ => new HttpClient(handler, disposeHandler: false));
        return new TapoKlapProvider(factory, new PtzMoveRunner(time ?? TimeProvider.System, NullLogger<PtzMoveRunner>.Instance), NullLogger<TapoKlapProvider>.Instance);
    }

    [Fact]
    public void Protocol_ShouldBeTapoKlap_WhenSeenAsAPrivacyProvider()
    {
        var provider = MakeProvider(new StubHttpHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)));
        Assert.Equal(SupportedProtocol.TapoKlap, ((IPrivacyCapabilityProvider)provider).Protocol);
    }

    [Fact]
    public void Protocol_ShouldBeTapoKlap_WhenSeenAsAPtzProvider()
    {
        var provider = MakeProvider(new StubHttpHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)));
        Assert.Equal(SupportedProtocol.TapoKlap, ((IPtzCapabilityProvider)provider).Protocol);
    }

    [Fact]
    public async Task ProbeAsync_ShouldReturnFalse_WhenTheFirstHandshakeIsRefused()
    {
        var provider = MakeProvider(new StubHttpHandler(_ => new HttpResponseMessage(HttpStatusCode.Unauthorized)));

        var result = await provider.ProbeAsync(MakeCamera(), MakeBinding(CameraCapability.HardwarePrivacy));

        Assert.False(result);
    }

    [Fact]
    public async Task ProbeAsync_ShouldReturnFalse_WhenTheFirstHandshakeBodyIsTooShort()
    {
        var provider = MakeProvider(new StubHttpHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new ByteArrayContent(new byte[10])
        }));

        var result = await provider.ProbeAsync(MakeCamera(), MakeBinding(CameraCapability.HardwarePrivacy));

        Assert.False(result);
    }

    [Fact]
    public async Task SetPrivacyModeAsync_ShouldThrow_WhenAuthenticationFails()
    {
        var provider = MakeProvider(new StubHttpHandler(_ => new HttpResponseMessage(HttpStatusCode.Unauthorized)));

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => provider.SetPrivacyModeAsync(MakeCamera(), MakeBinding(CameraCapability.HardwarePrivacy), active: true));
    }

    [Fact]
    public async Task OpenMotionAsync_ShouldThrow_WhenAuthenticationFails()
    {
        var provider = MakeProvider(new StubHttpHandler(_ => new HttpResponseMessage(HttpStatusCode.Unauthorized)));

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => provider.OpenMotionAsync(MakeCamera(), MakeBinding(CameraCapability.Ptz)));
    }

    [Theory]
    [InlineData(PtzDirection.Up, 0, 50)]
    [InlineData(PtzDirection.Down, 0, -50)]
    [InlineData(PtzDirection.Left, -50, 0)]
    [InlineData(PtzDirection.Right, 50, 0)]
    [InlineData(PtzDirection.UpLeft, -50, 50)]
    [InlineData(PtzDirection.UpRight, 50, 50)]
    [InlineData(PtzDirection.DownLeft, -50, -50)]
    [InlineData(PtzDirection.DownRight, 50, -50)]
    public void DirectionToVelocity_ShouldReturnTheMatchingXAndY_WhenMappingEachDirection(PtzDirection direction, int expectedX, int expectedY)
    {
        var (x, y) = TapoKlapProvider.DirectionToVelocity(direction, speed: 50);
        Assert.Equal(expectedX, x);
        Assert.Equal(expectedY, y);
    }

    [Fact]
    public void DirectionToVelocity_ShouldClampTheSpeedToOneHundred_WhenTheSpeedIsAboveIt()
    {
        var (x, _) = TapoKlapProvider.DirectionToVelocity(PtzDirection.Right, speed: 200);
        Assert.Equal(100, x);
    }

    [Fact]
    public void DirectionToVelocity_ShouldClampTheSpeedToOne_WhenTheSpeedIsZero()
    {
        var (x, _) = TapoKlapProvider.DirectionToVelocity(PtzDirection.Right, speed: 0);
        Assert.Equal(1, x);
    }

    [Fact]
    public async Task OpenMotionAsync_ShouldShakeHandsOnceAndNumberEveryCommand_WhenSeveralMovesAreMade()
    {
        // Arrange
        var time = new FakeTimeProvider();
        var camera = new FakeKlapCamera("admin", "secret");
        await using var motion = await MakeProvider(camera, time).OpenMotionAsync(MakeCamera(), MakeBinding(CameraCapability.Ptz));
        var first = motion.MoveForAsync(PtzDirection.Left, 50, Tap);
        time.Advance(Tap);
        await first;
        var second = motion.MoveForAsync(PtzDirection.Left, 50, Tap);

        // Act
        time.Advance(Tap);
        await second;

        // Assert
        Assert.Equal(1, camera.Handshakes);
        Assert.Equal(["1", "2", "3", "4"], camera.Sequences);
    }

    [Fact]
    public async Task MoveForAsync_ShouldStopTheDurationAfterTheMove_WhenTheCameraAnswersAtOnce()
    {
        // Arrange
        var time = new FakeTimeProvider();
        var camera = new FakeKlapCamera("admin", "secret") { Clock = time };
        await using var motion = await MakeProvider(camera, time).OpenMotionAsync(MakeCamera(), MakeBinding(CameraCapability.Ptz));
        var step = motion.MoveForAsync(PtzDirection.Left, 50, Tap);
        var moved = await camera.NextCommandAsync();

        // Act
        time.Advance(Tap);
        var stopped = await camera.NextCommandAsync();

        // Assert
        Assert.Equal(Tap, stopped - moved);
        Assert.Equal(Tap, await step);
    }

    [Fact]
    public async Task StoppedAsync_ShouldReturnTheTimeFromTheMoveSentToTheStopSent_WhenAPressIsHeld()
    {
        // Arrange
        var time = new FakeTimeProvider();
        var camera = new FakeKlapCamera("admin", "secret") { Clock = time };
        await using var motion = await MakeProvider(camera, time).OpenMotionAsync(MakeCamera(), MakeBinding(CameraCapability.Ptz));
        var released = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        Assert.True(await motion.StartAsync(PtzDirection.Left, 50, released.Task));
        time.Advance(TimeSpan.FromMilliseconds(1500));

        // Act
        released.SetResult();
        var moved = await motion.StoppedAsync();

        // Assert
        Assert.Equal(TimeSpan.FromMilliseconds(1500), moved);
        Assert.Equal(1, camera.Handshakes);
    }

    // A Tapo camera that completes the KLAP handshake for its account and accepts every command, noting its sequence number and arrival.
    private sealed class FakeKlapCamera(string username, string password) : HttpMessageHandler
    {
        private static readonly byte[] ServerSeed = new byte[16];

        private readonly System.Threading.Channels.Channel<DateTimeOffset> _commands = System.Threading.Channels.Channel.CreateUnbounded<DateTimeOffset>();

        public TimeProvider Clock { get; init; } = TimeProvider.System;

        public int Handshakes { get; private set; }

        public List<string> Sequences { get; } = [];

        public async Task<DateTimeOffset> NextCommandAsync() => await _commands.Reader.ReadAsync();

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var path = request.RequestUri!.AbsolutePath;
            if (path.EndsWith("/handshake1", StringComparison.Ordinal))
            {
                Handshakes++;
                var localSeed = await request.Content!.ReadAsByteArrayAsync(cancellationToken);
                var serverHash = SHA256.HashData([.. ServerSeed, .. localSeed, .. TapoKlapProvider.ComputeCredentialHash(username, password)]);
                return new HttpResponseMessage(HttpStatusCode.OK) { Content = new ByteArrayContent([.. ServerSeed, .. serverHash]) };
            }

            var response = new HttpResponseMessage(HttpStatusCode.OK);
            if (path.EndsWith("/handshake2", StringComparison.Ordinal))
                response.Headers.Add("Set-Cookie", "TP_SESSIONID=session-1");
            else
            {
                Sequences.Add(request.RequestUri.Query["?seq=".Length..]);
                _commands.Writer.TryWrite(Clock.GetUtcNow());
            }
            return response;
        }
    }

    private sealed class StubHttpHandler(Func<HttpRequestMessage, HttpResponseMessage> respond) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
            => Task.FromResult(respond(request));
    }
}
