using System.Net;
using Microsoft.Extensions.Logging.Abstractions;
using Vyzio.Core.Entities;
using Vyzio.Infrastructure.Services;

namespace Vyzio.Tests.Services;

public class FrigateEventImageProviderTests
{
    [Theory]
    [InlineData(FrigateEventImage.Snapshot, "http://frigate:5000/api/events/evt-1/snapshot.jpg")]
    [InlineData(FrigateEventImage.Thumbnail, "http://frigate:5000/api/events/evt-1/thumbnail.jpg")]
    public async Task TryGetImageAsync_reads_the_file_frigate_wrote_for_that_image(
        FrigateEventImage image, string expectedUrl)
    {
        var handler = new CapturingHandler();
        var provider = new FrigateEventImageProvider(
            new HttpClient(handler) { BaseAddress = new Uri("http://frigate:5000/") },
            NullLogger<FrigateEventImageProvider>.Instance);

        var stream = await provider.TryGetImageAsync("evt-1", image);

        Assert.NotNull(stream);
        Assert.Equal(expectedUrl, handler.LastUrl);
    }

    private sealed class CapturingHandler : HttpMessageHandler
    {
        public string? LastUrl { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            LastUrl = request.RequestUri?.ToString();
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new ByteArrayContent([1, 2, 3])
            });
        }
    }
}
