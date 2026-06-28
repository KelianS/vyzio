using System.Net;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Vyzio.Core.Entities;
using Vyzio.Infrastructure.VendorAdapters;

namespace Vyzio.Tests.Services;

public class TapoCameraAdapterTests
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

    private static TapoCameraAdapter MakeAdapter(HttpMessageHandler handler)
    {
        var client = new HttpClient(handler);
        var factory = Substitute.For<IHttpClientFactory>();
        factory.CreateClient("tapo").Returns(client);
        return new TapoCameraAdapter(factory, NullLogger<TapoCameraAdapter>.Instance);
    }

    [Fact]
    public async Task SupportsPrivacyMode_always_returns_true()
    {
        var factory = Substitute.For<IHttpClientFactory>();
        var sut = new TapoCameraAdapter(factory, NullLogger<TapoCameraAdapter>.Instance);

        var result = await sut.SupportsPrivacyModeAsync(MakeCamera());

        Assert.True(result);
    }

    [Fact]
    public async Task SetPrivacyMode_throws_invalid_operation_when_handshake1_fails()
    {
        var handler = new StubHttpHandler(_ => new HttpResponseMessage(HttpStatusCode.Unauthorized));
        var sut = MakeAdapter(handler);

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => sut.SetPrivacyModeAsync(MakeCamera(), active: true));
    }

    [Fact]
    public async Task SetPrivacyMode_throws_invalid_operation_when_handshake1_returns_short_body()
    {
        // Handshake1 succeeds (200 OK) but response body is too short to contain server seed + hash
        var handler = new StubHttpHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new ByteArrayContent(new byte[10]) // < 48 bytes required
        });
        var sut = MakeAdapter(handler);

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => sut.SetPrivacyModeAsync(MakeCamera(), active: true));
    }

    private sealed class StubHttpHandler(Func<HttpRequestMessage, HttpResponseMessage> respond) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
            => Task.FromResult(respond(request));
    }
}
