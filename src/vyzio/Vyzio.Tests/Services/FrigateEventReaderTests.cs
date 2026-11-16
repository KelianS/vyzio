using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.Services;

namespace Vyzio.Tests.Services;

public class FrigateEventReaderTests
{
    [Fact]
    public async Task QueryAsync_ShouldThrowFrigateUnavailable_WhenTheSurveillanceIsUnreachable()
    {
        // An empty list would read as "no detection", which is a different thing entirely (ADR-12).
        var reader = new FrigateEventReader(
            new HttpClient(new UnreachableHandler()) { BaseAddress = new Uri("http://frigate:5000/") });

        await Assert.ThrowsAsync<FrigateUnavailableException>(
            () => reader.QueryAsync(new FrigateDetectionQuery()));
    }

    [Fact]
    public async Task QueryAsync_ShouldAskFrigateForAnyOfTheValues_WhenSeveralAreGivenPerFilter()
    {
        // Arrange
        var handler = new RecordingHandler();
        var reader = new FrigateEventReader(new HttpClient(handler) { BaseAddress = new Uri("http://frigate:5000/") });

        // Act
        await reader.QueryAsync(new FrigateDetectionQuery(
            Cameras: ["front_door", "garage"],
            Labels: ["car", "dog"],
            Identities: ["Alice", "Jean Marc"]));

        // Assert
        Assert.Contains(
            "cameras=front_door,garage&labels=car,dog&sub_labels=Alice,Jean%20Marc",
            handler.RequestedUrl,
            StringComparison.Ordinal);
    }

    private sealed class RecordingHandler : HttpMessageHandler
    {
        public string RequestedUrl { get; private set; } = string.Empty;

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            RequestedUrl = request.RequestUri!.AbsoluteUri;
            return Task.FromResult(new HttpResponseMessage(System.Net.HttpStatusCode.OK)
            {
                Content = new StringContent("[]", System.Text.Encoding.UTF8, "application/json"),
            });
        }
    }

    private sealed class UnreachableHandler : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
            => throw new HttpRequestException("No route to host.");
    }
}
