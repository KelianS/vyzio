using System.Net;
using System.Text;
using Microsoft.Extensions.Logging.Abstractions;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.Services;

namespace Vyzio.Tests.Services;

public class FrigateDetectionEraserTests
{
    private const string EndedEvent = """{"id":"evt-1","end_time":1700000030.5}""";
    private const string EndedReview = """{"id":"rev-1","end_time":1700000040.0}""";

    private static (FrigateDetectionEraser Eraser, ScriptedFrigate Frigate) CreateSut(
        Dictionary<string, (HttpStatusCode Status, string Body)> answers)
    {
        var frigate = new ScriptedFrigate(answers);
        var eraser = new FrigateDetectionEraser(
            new HttpClient(frigate) { BaseAddress = new Uri("http://frigate:5000/") },
            NullLogger<FrigateDetectionEraser>.Instance);
        return (eraser, frigate);
    }

    [Fact]
    public async Task EraseAsync_ShouldDeleteTheReviewItemBeforeTheEvent_WhenTheDetectionIsOver()
    {
        // Arrange
        var (eraser, frigate) = CreateSut(new()
        {
            ["GET /api/events/evt-1"] = (HttpStatusCode.OK, EndedEvent),
            ["GET /api/review/event/evt-1"] = (HttpStatusCode.OK, EndedReview),
            ["POST /api/reviews/delete"] = (HttpStatusCode.OK, """{"success":true}"""),
            ["DELETE /api/events/evt-1"] = (HttpStatusCode.OK, """{"success":true}"""),
        });

        // Act
        var erasure = await eraser.EraseAsync("evt-1");

        // Assert
        Assert.Equal(DetectionErasure.Erased, erasure);
        Assert.Equal(
            ["GET /api/events/evt-1", "GET /api/review/event/evt-1", "POST /api/reviews/delete", "DELETE /api/events/evt-1"],
            frigate.Requests);
        Assert.Equal("""{"ids":["rev-1"]}""", frigate.ReviewDeletionBody);
    }

    [Fact]
    public async Task EraseAsync_ShouldOnlyDeleteTheEvent_WhenNoReviewItemHoldsIt()
    {
        // Arrange
        var (eraser, frigate) = CreateSut(new()
        {
            ["GET /api/events/evt-1"] = (HttpStatusCode.OK, EndedEvent),
            ["GET /api/review/event/evt-1"] = (HttpStatusCode.NotFound, """{"success":false}"""),
            ["DELETE /api/events/evt-1"] = (HttpStatusCode.OK, """{"success":true}"""),
        });

        // Act
        var erasure = await eraser.EraseAsync("evt-1");

        // Assert
        Assert.Equal(DetectionErasure.Erased, erasure);
        Assert.DoesNotContain("POST /api/reviews/delete", frigate.Requests);
        Assert.Contains("DELETE /api/events/evt-1", frigate.Requests);
    }

    [Fact]
    public async Task EraseAsync_ShouldAnswerNotFoundAndEraseNothing_WhenFrigateKnowsNoSuchEvent()
    {
        // Arrange
        var (eraser, frigate) = CreateSut(new()
        {
            ["GET /api/events/unknown"] = (HttpStatusCode.NotFound, """{"success":false}"""),
        });

        // Act
        var erasure = await eraser.EraseAsync("unknown");

        // Assert
        Assert.Equal(DetectionErasure.NotFound, erasure);
        Assert.Equal(["GET /api/events/unknown"], frigate.Requests);
    }

    [Theory]
    [InlineData("""{"id":"evt-1","end_time":null}""", """{"id":"rev-1","end_time":1700000040.0}""")]
    [InlineData("""{"id":"evt-1","end_time":1700000030.5}""", """{"id":"rev-1","end_time":null}""")]
    public async Task EraseAsync_ShouldAnswerInProgressAndEraseNothing_WhenTheEventOrItsReviewIsStillOpen(
        string eventBody, string reviewBody)
    {
        // Arrange
        var (eraser, frigate) = CreateSut(new()
        {
            ["GET /api/events/evt-1"] = (HttpStatusCode.OK, eventBody),
            ["GET /api/review/event/evt-1"] = (HttpStatusCode.OK, reviewBody),
        });

        // Act
        var erasure = await eraser.EraseAsync("evt-1");

        // Assert
        Assert.Equal(DetectionErasure.InProgress, erasure);
        Assert.DoesNotContain(frigate.Requests, request => !request.StartsWith("GET ", StringComparison.Ordinal));
    }

    [Fact]
    public async Task EraseAsync_ShouldSayNothingWasErased_WhenFrigateRefusesTheReviewDeletion()
    {
        // Arrange
        var (eraser, frigate) = CreateSut(new()
        {
            ["GET /api/events/evt-1"] = (HttpStatusCode.OK, EndedEvent),
            ["GET /api/review/event/evt-1"] = (HttpStatusCode.OK, EndedReview),
            ["POST /api/reviews/delete"] = (HttpStatusCode.Forbidden, """{"message":"admin only"}"""),
        });

        // Act
        var failure = await Assert.ThrowsAsync<DetectionErasureFailedException>(() => eraser.EraseAsync("evt-1"));

        // Assert
        Assert.Equal(
            "POST /api/reviews/delete answered 403 Forbidden: {\"message\":\"admin only\"}; nothing erased yet",
            failure.Message);
        Assert.False(failure.PartlyErased);
        Assert.DoesNotContain("DELETE /api/events/evt-1", frigate.Requests);
    }

    [Fact]
    public async Task EraseAsync_ShouldSayTheRecordingIsAlreadyErased_WhenTheEventDeletionFailsAfterTheReview()
    {
        // Arrange
        var (eraser, _) = CreateSut(new()
        {
            ["GET /api/events/evt-1"] = (HttpStatusCode.OK, EndedEvent),
            ["GET /api/review/event/evt-1"] = (HttpStatusCode.OK, EndedReview),
            ["POST /api/reviews/delete"] = (HttpStatusCode.OK, """{"success":true}"""),
            ["DELETE /api/events/evt-1"] = (HttpStatusCode.InternalServerError, "database is locked"),
        });

        // Act
        var failure = await Assert.ThrowsAsync<DetectionErasureFailedException>(() => eraser.EraseAsync("evt-1"));

        // Assert
        Assert.Equal(
            "DELETE /api/events/evt-1 answered 500 Internal Server Error: database is locked; "
            + "its review item and the overlapping recording are already erased",
            failure.Message);
        Assert.True(failure.PartlyErased);
    }

    [Fact]
    public async Task EraseAsync_ShouldSayFrigateGaveNoAnswer_WhenItIsUnreachable()
    {
        // Arrange
        var eraser = new FrigateDetectionEraser(
            new HttpClient(new UnreachableHandler()) { BaseAddress = new Uri("http://frigate:5000/") },
            NullLogger<FrigateDetectionEraser>.Instance);

        // Act
        var failure = await Assert.ThrowsAsync<DetectionErasureFailedException>(() => eraser.EraseAsync("evt-1"));

        // Assert
        Assert.Equal("GET api/events/evt-1 got no answer: No route to host.; nothing erased yet", failure.Message);
    }

    private sealed class ScriptedFrigate(Dictionary<string, (HttpStatusCode Status, string Body)> answers)
        : HttpMessageHandler
    {
        public List<string> Requests { get; } = [];
        public string? ReviewDeletionBody { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            var key = $"{request.Method} {request.RequestUri!.AbsolutePath}";
            Requests.Add(key);
            if (key == "POST /api/reviews/delete")
                ReviewDeletionBody = await request.Content!.ReadAsStringAsync(ct);

            var (status, body) = answers[key];
            return new HttpResponseMessage(status)
            {
                RequestMessage = request,
                Content = new StringContent(body, Encoding.UTF8, "application/json"),
            };
        }
    }

    private sealed class UnreachableHandler : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
            => throw new HttpRequestException("No route to host.");
    }
}
