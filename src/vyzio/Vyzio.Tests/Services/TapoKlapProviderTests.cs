using System.Net;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.CapabilityProviders;

namespace Vyzio.Tests.Services;

public class TapoKlapProviderTests
{
    private static Camera MakeCamera() => new()
    {
        Id = "cam1",
        Slug = "cam1",
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
        Protocol = CapabilityProtocol.TapoKlap,
        Verified = true,
    };

    private static TapoKlapProvider MakeProvider(HttpMessageHandler handler)
    {
        var factory = Substitute.For<IHttpClientFactory>();
        factory.CreateClient("tapo").Returns(new HttpClient(handler));
        return new TapoKlapProvider(factory, NullLogger<TapoKlapProvider>.Instance);
    }

    [Fact]
    public void Protocol_as_privacy_provider_is_TapoKlap()
    {
        var provider = MakeProvider(new StubHttpHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)));
        Assert.Equal(CapabilityProtocol.TapoKlap, ((IPrivacyCapabilityProvider)provider).Protocol);
    }

    [Fact]
    public void Protocol_as_ptz_provider_is_TapoKlap()
    {
        var provider = MakeProvider(new StubHttpHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)));
        Assert.Equal(CapabilityProtocol.TapoKlap, ((IPtzCapabilityProvider)provider).Protocol);
    }

    [Fact]
    public async Task ProbeAsync_returns_false_when_handshake1_fails()
    {
        var provider = MakeProvider(new StubHttpHandler(_ => new HttpResponseMessage(HttpStatusCode.Unauthorized)));

        var result = await provider.ProbeAsync(MakeCamera(), MakeBinding(CameraCapability.PrivacyMode));

        Assert.False(result);
    }

    [Fact]
    public async Task ProbeAsync_returns_false_when_handshake1_body_too_short()
    {
        var provider = MakeProvider(new StubHttpHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new ByteArrayContent(new byte[10])
        }));

        var result = await provider.ProbeAsync(MakeCamera(), MakeBinding(CameraCapability.PrivacyMode));

        Assert.False(result);
    }

    [Fact]
    public async Task SetPrivacyModeAsync_throws_when_authentication_fails()
    {
        var provider = MakeProvider(new StubHttpHandler(_ => new HttpResponseMessage(HttpStatusCode.Unauthorized)));

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => provider.SetPrivacyModeAsync(MakeCamera(), MakeBinding(CameraCapability.PrivacyMode), active: true));
    }

    [Fact]
    public async Task PtzMoveAsync_throws_when_authentication_fails()
    {
        var provider = MakeProvider(new StubHttpHandler(_ => new HttpResponseMessage(HttpStatusCode.Unauthorized)));

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => provider.PtzMoveAsync(MakeCamera(), MakeBinding(CameraCapability.Ptz), PtzDirection.Up, speed: 50));
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
    public void DirectionToVelocity_maps_all_directions(PtzDirection direction, int expectedX, int expectedY)
    {
        var (x, y) = TapoKlapProvider.DirectionToVelocity(direction, speed: 50);
        Assert.Equal(expectedX, x);
        Assert.Equal(expectedY, y);
    }

    [Fact]
    public void DirectionToVelocity_clamps_speed_to_100()
    {
        var (x, _) = TapoKlapProvider.DirectionToVelocity(PtzDirection.Right, speed: 200);
        Assert.Equal(100, x);
    }

    [Fact]
    public void DirectionToVelocity_clamps_speed_to_minimum_1()
    {
        var (x, _) = TapoKlapProvider.DirectionToVelocity(PtzDirection.Right, speed: 0);
        Assert.Equal(1, x);
    }

    private sealed class StubHttpHandler(Func<HttpRequestMessage, HttpResponseMessage> respond) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
            => Task.FromResult(respond(request));
    }
}
