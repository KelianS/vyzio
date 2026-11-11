using System.Net;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.Services;

namespace Vyzio.Tests.Services;

public class FrigateClipProviderTests
{
    private static FrigateClipProvider CreateSut(HttpMessageHandler frigate)
        => new(
            new HttpClient(frigate) { BaseAddress = new Uri("http://frigate:5000/") },
            new FakeTimeProvider(),
            NullLogger<FrigateClipProvider>.Instance);

    [Theory]
    [InlineData(HttpStatusCode.NotFound)]
    [InlineData(HttpStatusCode.BadRequest)]
    public async Task ReadClipAsync_ShouldAnswerNoClip_WhenFrigateSaysTheClipDoesNotExist(HttpStatusCode status)
    {
        // Arrange
        var sut = CreateSut(new AnsweringHandler(status, """{"message":"No recordings found for the specified time range"}"""));

        // Act
        var clip = await sut.ReadClipAsync("evt-1");

        // Assert
        Assert.Null(clip);
    }

    [Fact]
    public async Task ReadClipAsync_ShouldReturnTheVideo_WhenFrigateServesIt()
    {
        // Arrange
        var sut = CreateSut(new AnsweringHandler(HttpStatusCode.OK, "mp4-bytes"));

        // Act
        await using var clip = await sut.ReadClipAsync("evt-1");

        // Assert
        Assert.NotNull(clip);
        Assert.Equal(9, clip.Length);
    }

    [Theory]
    [InlineData(HttpStatusCode.InternalServerError, "x", "GET api/events/evt-1/clip.mp4 answered 500 Internal Server Error")]
    [InlineData(HttpStatusCode.OK, "", "GET api/events/evt-1/clip.mp4 answered an empty body")]
    public async Task ReadClipAsync_ShouldThrowWithTheDetail_WhenFrigateFailsToServeIt(
        HttpStatusCode status, string body, string expectedDetail)
    {
        // Arrange
        var sut = CreateSut(new AnsweringHandler(status, body));

        // Act
        var failure = await Assert.ThrowsAsync<FrigateClipUnreadableException>(() => sut.ReadClipAsync("evt-1"));

        // Assert
        Assert.Equal(expectedDetail, failure.Message);
    }

    [Fact]
    public async Task ReadClipAsync_ShouldThrowRatherThanSayItIsGone_WhenFrigateIsUnreachable()
    {
        // Arrange
        var sut = CreateSut(new UnreachableHandler());

        // Act
        var failure = await Assert.ThrowsAsync<FrigateClipUnreadableException>(() => sut.ReadClipAsync("evt-1"));

        // Assert
        Assert.Equal("GET api/events/evt-1/clip.mp4 got no answer: No route to host.", failure.Message);
    }

    private sealed class AnsweringHandler(HttpStatusCode status, string body) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
            => Task.FromResult(new HttpResponseMessage(status) { Content = new StringContent(body) });
    }

    private sealed class UnreachableHandler : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
            => throw new HttpRequestException("No route to host.");
    }
}
