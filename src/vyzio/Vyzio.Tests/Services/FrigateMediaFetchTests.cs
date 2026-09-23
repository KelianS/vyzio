using System.Net;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;
using Vyzio.Infrastructure.Services;
using Vyzio.Tests.Services.Hosting;

namespace Vyzio.Tests.Services;

public class FrigateMediaFetchTests
{
    private static readonly TimeSpan Step = TimeSpan.FromSeconds(1);

    private readonly FakeTimeProvider _time = BackgroundLoop.ClockAt("2026-09-23T10:00:00+00:00");

    [Fact]
    public async Task TryReadAsync_ShouldReturnTheMedia_WhenFrigateWritesItWithinTheWindow()
    {
        // Frigate finalizes the file a few seconds after the event ends (ADR-49).
        var handler = new ScriptedHandler(_time, HttpStatusCode.NotFound, HttpStatusCode.NotFound, HttpStatusCode.OK);

        var read = ReadAsync(handler, TimeSpan.FromMinutes(10));
        await _time.AdvanceUntilAsync(read, Step);

        Assert.NotNull(await read);
        Assert.Equal(3, handler.Calls.Count);
    }

    [Fact]
    public async Task TryReadAsync_ShouldReadOnce_WhenNoWindowIsGranted()
    {
        var handler = new ScriptedHandler(_time, HttpStatusCode.NotFound, HttpStatusCode.OK);

        var stream = await ReadAsync(handler, TimeSpan.Zero).ObservedAsync();

        Assert.Null(stream);
        Assert.Single(handler.Calls);
    }

    [Fact]
    public async Task TryReadAsync_ShouldGiveUpAtOnce_WhenFrigateAnswersAnError()
    {
        // A 500 is not a media being written: retrying it only delays the notification.
        var handler = new ScriptedHandler(_time, HttpStatusCode.InternalServerError, HttpStatusCode.OK);

        var stream = await ReadAsync(handler, TimeSpan.FromMinutes(10)).ObservedAsync();

        Assert.Null(stream);
        Assert.Single(handler.Calls);
    }

    [Fact]
    public async Task TryReadAsync_ShouldGiveUp_WhenTheWindowEndsBeforeFrigateWritesTheMedia()
    {
        var deadline = _time.GetUtcNow().AddSeconds(10);
        var handler = new ScriptedHandler(_time, HttpStatusCode.NotFound);

        var read = ReadAsync(handler, TimeSpan.FromSeconds(10));
        await _time.AdvanceUntilAsync(read, Step);

        Assert.Null(await read);
        Assert.True(handler.Calls.Count > 1);
        Assert.True(handler.Calls[^1] >= deadline);
    }

    private Task<Stream?> ReadAsync(ScriptedHandler handler, TimeSpan finalizationWindow)
        => FrigateMediaFetch.TryReadAsync(
            new HttpClient(handler) { BaseAddress = new Uri("http://frigate:5000/") },
            "api/events/evt-1/snapshot.jpg",
            "Snapshot",
            "evt-1",
            finalizationWindow,
            _time,
            NullLogger.Instance,
            CancellationToken.None);

    // Answers each call with the next status and records when it was asked.
    private sealed class ScriptedHandler(TimeProvider time, params HttpStatusCode[] statuses) : HttpMessageHandler
    {
        private readonly List<DateTimeOffset> _calls = [];

        public IReadOnlyList<DateTimeOffset> Calls => _calls;

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            var status = statuses[Math.Min(_calls.Count, statuses.Length - 1)];
            _calls.Add(time.GetUtcNow());

            return Task.FromResult(new HttpResponseMessage(status)
            {
                Content = new ByteArrayContent(status == HttpStatusCode.OK ? [1, 2, 3] : [])
            });
        }
    }
}
