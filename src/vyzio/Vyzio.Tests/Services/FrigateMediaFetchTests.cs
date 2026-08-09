using System.Net;
using Microsoft.Extensions.Logging.Abstractions;
using Vyzio.Infrastructure.Services;

namespace Vyzio.Tests.Services;

public class FrigateMediaFetchTests
{
    private static readonly TimeSpan ShortInterval = TimeSpan.FromMilliseconds(5);

    [Fact]
    public async Task TryReadAsync_retries_until_frigate_has_written_the_media()
    {
        // Frigate finalizes the file a few seconds after the event ends (ADR-49).
        var handler = new ScriptedHandler(
            HttpStatusCode.NotFound, HttpStatusCode.NotFound, HttpStatusCode.OK);

        var stream = await ReadAsync(handler, TimeSpan.FromSeconds(1));

        Assert.NotNull(stream);
        Assert.Equal(3, handler.Calls);
    }

    [Fact]
    public async Task TryReadAsync_reads_once_when_no_window_is_granted()
    {
        var handler = new ScriptedHandler(HttpStatusCode.NotFound, HttpStatusCode.OK);

        var stream = await ReadAsync(handler, TimeSpan.Zero);

        Assert.Null(stream);
        Assert.Equal(1, handler.Calls);
    }

    [Fact]
    public async Task TryReadAsync_gives_up_immediately_when_frigate_answers_an_error()
    {
        // A 500 is not a media being written: retrying it only delays the notification.
        var handler = new ScriptedHandler(HttpStatusCode.InternalServerError, HttpStatusCode.OK);

        var stream = await ReadAsync(handler, TimeSpan.FromSeconds(1));

        Assert.Null(stream);
        Assert.Equal(1, handler.Calls);
    }

    [Fact]
    public async Task TryReadAsync_stops_at_the_end_of_the_window()
    {
        var handler = new ScriptedHandler(HttpStatusCode.NotFound);

        var stream = await ReadAsync(handler, TimeSpan.FromMilliseconds(20));

        Assert.Null(stream);
        Assert.True(handler.Calls >= 1);
    }

    private static Task<Stream?> ReadAsync(ScriptedHandler handler, TimeSpan finalizationWindow)
        => FrigateMediaFetch.TryReadAsync(
            new HttpClient(handler) { BaseAddress = new Uri("http://frigate:5000/") },
            "api/events/evt-1/snapshot.jpg",
            "Snapshot",
            "evt-1",
            finalizationWindow,
            NullLogger.Instance,
            CancellationToken.None,
            ShortInterval);

    private sealed class ScriptedHandler(params HttpStatusCode[] statuses) : HttpMessageHandler
    {
        public int Calls { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            var status = statuses[Math.Min(Calls, statuses.Length - 1)];
            Calls++;

            return Task.FromResult(new HttpResponseMessage(status)
            {
                Content = new ByteArrayContent(status == HttpStatusCode.OK ? [1, 2, 3] : [])
            });
        }
    }
}
