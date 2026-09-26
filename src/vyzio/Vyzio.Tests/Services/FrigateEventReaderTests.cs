using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.Services;

namespace Vyzio.Tests.Services;

public class FrigateEventReaderTests
{
    [Fact]
    public async Task QueryAsync_ShouldThrowFrigateUnavailable_WhenTheSurveillanceIsUnreachable()
    {
        // An empty list would read as "no detection", which is a different thing entirely (ADR-49).
        var reader = new FrigateEventReader(
            new HttpClient(new UnreachableHandler()) { BaseAddress = new Uri("http://frigate:5000/") });

        await Assert.ThrowsAsync<FrigateUnavailableException>(
            () => reader.QueryAsync(new FrigateDetectionQuery()));
    }

    private sealed class UnreachableHandler : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
            => throw new HttpRequestException("No route to host.");
    }
}
