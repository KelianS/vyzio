using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.Services;

public sealed class FrigateDetectionEraser(HttpClient httpClient, ILogger<FrigateDetectionEraser> logger)
    : IFrigateDetectionEraser
{
    private const string NothingErased = "nothing erased yet";
    private const string RecordingErased = "its review item and the overlapping recording are already erased";
    private const int BodyExcerptLength = 200;

    public async Task<DetectionErasure> EraseAsync(string frigateEventId, CancellationToken ct = default)
    {
        var eventPath = $"api/events/{Uri.EscapeDataString(frigateEventId)}";

        using var eventAnswer = await SendAsync(HttpMethod.Get, eventPath, null, NothingErased, ct);
        if (eventAnswer.StatusCode == HttpStatusCode.NotFound)
            return DetectionErasure.NotFound;

        // Frigate writes a live event and its review item back on each update, so erasing either now would not hold.
        var detection = await ReadAsync<EndTimeDto>(eventAnswer, NothingErased, ct);
        if (detection.EndTime is null)
            return DetectionErasure.InProgress;

        using var reviewAnswer = await SendAsync(
            HttpMethod.Get, $"api/review/event/{Uri.EscapeDataString(frigateEventId)}", null, NothingErased, ct);
        string? reviewId = null;
        if (reviewAnswer.StatusCode != HttpStatusCode.NotFound)
        {
            var review = await ReadAsync<ReviewDto>(reviewAnswer, NothingErased, ct);
            if (review.EndTime is null)
                return DetectionErasure.InProgress;
            reviewId = review.Id;
        }

        var progress = NothingErased;
        if (reviewId is not null)
        {
            // The only review deletion Frigate offers; it also erases the recording overlapping the item (SPECS 6.2).
            using var reviewDeletion = await SendAsync(
                HttpMethod.Post, "api/reviews/delete", JsonContent.Create(new ReviewDeleteRequest([reviewId])), NothingErased, ct);
            await EnsureSuccessAsync(reviewDeletion, NothingErased, ct);
            progress = RecordingErased;
        }

        using var eventDeletion = await SendAsync(HttpMethod.Delete, eventPath, null, progress, ct);
        // Gone between the read and the deletion: that is the outcome asked for.
        if (eventDeletion.StatusCode != HttpStatusCode.NotFound)
            await EnsureSuccessAsync(eventDeletion, progress, ct);

        return DetectionErasure.Erased;
    }

    private async Task<HttpResponseMessage> SendAsync(
        HttpMethod method, string path, HttpContent? content, string progress, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(method, path) { Content = content };
        try
        {
            return await httpClient.SendAsync(request, ct);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException && !ct.IsCancellationRequested)
        {
            throw Fail($"{method} {path} got no answer: {ex.Message}; {progress}", progress, ex);
        }
    }

    private async Task EnsureSuccessAsync(HttpResponseMessage answer, string progress, CancellationToken ct)
    {
        if (answer.IsSuccessStatusCode)
            return;

        var body = await answer.Content.ReadAsStringAsync(ct);
        var excerpt = body.Length > BodyExcerptLength ? body[..BodyExcerptLength] : body;
        throw Fail(
            $"{answer.RequestMessage?.Method} {answer.RequestMessage?.RequestUri?.PathAndQuery} answered "
            + $"{(int)answer.StatusCode} {answer.ReasonPhrase}: {excerpt}; {progress}",
            progress);
    }

    private async Task<T> ReadAsync<T>(HttpResponseMessage answer, string progress, CancellationToken ct)
        where T : class
    {
        await EnsureSuccessAsync(answer, progress, ct);
        try
        {
            return await answer.Content.ReadFromJsonAsync<T>(ct)
                ?? throw new JsonException("The answer was empty.");
        }
        catch (JsonException ex)
        {
            throw Fail(
                $"{answer.RequestMessage?.Method} {answer.RequestMessage?.RequestUri?.PathAndQuery} answered "
                + $"an unreadable body: {ex.Message}; {progress}",
                progress,
                ex);
        }
    }

    private DetectionErasureFailedException Fail(string detail, string progress, Exception? inner = null)
    {
        var failure = new DetectionErasureFailedException(detail, progress == RecordingErased, inner);
        logger.LogError(failure, "Erasing a detection failed: {Detail}", detail);
        return failure;
    }

    private sealed class EndTimeDto
    {
        [JsonPropertyName("end_time")]
        public double? EndTime { get; init; }
    }

    private sealed class ReviewDto
    {
        [JsonPropertyName("id")]
        public string Id { get; init; } = string.Empty;

        [JsonPropertyName("end_time")]
        public double? EndTime { get; init; }
    }

    private sealed record ReviewDeleteRequest([property: JsonPropertyName("ids")] IReadOnlyList<string> Ids);
}
