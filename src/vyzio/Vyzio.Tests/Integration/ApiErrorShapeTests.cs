using System.Net;
using System.Text.Json;
using NSubstitute;
using NSubstitute.ExceptionExtensions;
using Vyzio.Core.Entities;

namespace Vyzio.Tests.Integration;

// The interface reads every failure in one shape, whoever wrote it (BACKEND-18).
public class ApiErrorShapeTests(DeleteDetectionApiFactory signedIn, AccessApiFactory signedOut)
    : IClassFixture<DeleteDetectionApiFactory>, IClassFixture<AccessApiFactory>
{
    private static async Task<JsonElement> ProblemOf(HttpResponseMessage response, HttpStatusCode expected)
    {
        Assert.Equal(expected, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var problem = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement.Clone();
        Assert.Equal((int)expected, problem.GetProperty("status").GetInt32());
        Assert.False(string.IsNullOrWhiteSpace(problem.GetProperty("detail").GetString()));
        Assert.False(string.IsNullOrWhiteSpace(problem.GetProperty("traceId").GetString()));
        return problem;
    }

    [Fact]
    public async Task AnyRoute_ShouldAnswerAProblemNamedUnauthorized_WhenNoSessionIsSent()
    {
        // Arrange
        signedOut.ResetState();
        using var client = signedOut.CreateClient();

        // Act
        var response = await client.GetAsync("/api/cameras");

        // Assert
        var problem = await ProblemOf(response, HttpStatusCode.Unauthorized);
        Assert.Equal("unauthorized", problem.GetProperty("code").GetString());
    }

    [Fact]
    public async Task UnknownRoute_ShouldAnswerAProblemNamedNotFound_WhenNoEndpointMatches()
    {
        // Arrange
        using var client = signedIn.CreateClient();

        // Act
        var response = await client.GetAsync("/api/no-such-route");

        // Assert
        var problem = await ProblemOf(response, HttpStatusCode.NotFound);
        Assert.Equal("not_found", problem.GetProperty("code").GetString());
    }

    [Fact]
    public async Task KnownRoute_ShouldAnswerAProblemNamedMethodNotAllowed_WhenTheMethodIsNotServed()
    {
        // Arrange
        using var client = signedIn.CreateClient();

        // Act
        var response = await client.PutAsync("/api/detection-events/1700000000.1-abc123", content: null);

        // Assert
        var problem = await ProblemOf(response, HttpStatusCode.MethodNotAllowed);
        Assert.Equal("method_not_allowed", problem.GetProperty("code").GetString());
    }

    [Fact]
    public async Task Endpoint_ShouldAnswerAProblemNamedBadRequest_WhenTheBodyCannotBeRead()
    {
        // Arrange
        using var client = signedIn.CreateClient();
        using var unreadable = new StringContent("{ not json", System.Text.Encoding.UTF8, "application/json");

        // Act
        var response = await client.PatchAsync("/api/detection-events/1700000000.1-abc123/identity", unreadable);

        // Assert
        var problem = await ProblemOf(response, HttpStatusCode.BadRequest);
        Assert.Equal("bad_request", problem.GetProperty("code").GetString());
    }

    [Fact]
    public async Task Endpoint_ShouldAnswerItsCodeAndDetailAsAProblem_WhenItRefusesTheRequest()
    {
        // Arrange
        signedIn.Eraser.EraseAsync("1700000000.7-film01", Arg.Any<CancellationToken>()).Returns(DetectionErasure.InProgress);
        using var client = signedIn.CreateClient();

        // Act
        var response = await client.DeleteAsync("/api/detection-events/1700000000.7-film01");

        // Assert
        var problem = await ProblemOf(response, HttpStatusCode.Conflict);
        Assert.Equal("detection_in_progress", problem.GetProperty("code").GetString());
        Assert.Equal("Detection 1700000000.7-film01 is still being filmed; nothing was erased.", problem.GetProperty("detail").GetString());
    }

    [Fact]
    public async Task Endpoint_ShouldAnswerUnexpectedErrorWithTheTypeOnly_WhenAnExceptionIsUnhandled()
    {
        // Arrange
        signedIn.Eraser.EraseAsync("1700000000.8-boom01", Arg.Any<CancellationToken>())
            .ThrowsAsync(new InvalidOperationException("rtsp://viewer:s3cret@192.168.1.10/stream1 broke"));
        using var client = signedIn.CreateClient();

        // Act
        var response = await client.DeleteAsync("/api/detection-events/1700000000.8-boom01");

        // Assert
        var problem = await ProblemOf(response, HttpStatusCode.InternalServerError);
        Assert.Equal("unexpected_error", problem.GetProperty("code").GetString());
        Assert.Equal(nameof(InvalidOperationException), problem.GetProperty("detail").GetString());
        Assert.DoesNotContain("s3cret", problem.ToString(), StringComparison.Ordinal);
    }
}
