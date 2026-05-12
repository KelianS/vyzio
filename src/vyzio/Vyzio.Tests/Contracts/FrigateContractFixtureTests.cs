using System.Net;
using System.Text;
using Vyzio.Api.Integration.Frigate;
using Vyzio.Application.UseCases.Frigate;

namespace Vyzio.Tests.Contracts;

public sealed class FrigateMqttContractFixtureTests
{
    [Theory]
    [InlineData("mqtt/frigate-0.17/new_person.json", "frigate-evt-201", "new", "front_door", "person", true, true)]
    [InlineData("mqtt/frigate-0.17/update_car.json", "frigate-evt-202", "update", "driveway", "car", false, true)]
    public void TryParseRelevantEvent_accepts_supported_frigate_payloads(
        string fixturePath,
        string expectedEventId,
        string expectedLifecycle,
        string expectedCamera,
        string expectedLabel,
        bool expectedHasClip,
        bool expectedHasSnapshot)
    {
        var sut = new FrigateEventContractAdapter(new FrigateLabelFilter(["person", "car"]));
        var payload = FixtureLoader.LoadText(fixturePath);

        var ok = sut.TryParseRelevantEvent(payload, out var consumedEvent);

        Assert.True(ok);
        Assert.NotNull(consumedEvent);
        Assert.Equal(expectedEventId, consumedEvent!.FrigateEventId);
        Assert.Equal(expectedLifecycle, consumedEvent.Lifecycle);
        Assert.Equal(expectedCamera, consumedEvent.Camera);
        Assert.Equal(expectedLabel, consumedEvent.Label);
        Assert.Equal(expectedHasClip, consumedEvent.HasClip);
        Assert.Equal(expectedHasSnapshot, consumedEvent.HasSnapshot);
    }

    [Fact]
    public void TryParseRelevantEvent_rejects_unknown_payload_shapes_that_drop_required_fields()
    {
        var sut = new FrigateEventContractAdapter(new FrigateLabelFilter(["person"]));
        var payload = FixtureLoader.LoadText("mqtt/frigate-0.17/missing_camera.json");

        var ok = sut.TryParseRelevantEvent(payload, out var consumedEvent);

        Assert.False(ok);
        Assert.Null(consumedEvent);
    }
}

public sealed class FrigateRestContractFixtureTests
{
    [Theory]
    [InlineData("rest/frigate-0.17/sub_label_string.json", "Alice")]
    [InlineData("rest/frigate-0.17/sub_label_array.json", "Bob")]
    [InlineData("rest/frigate-0.17/sub_label_missing.json", null)]
    public async Task TryGetIdentityAsync_reads_supported_sub_label_shapes(string fixturePath, string? expectedIdentity)
    {
        using var httpClient = new HttpClient(new StubHttpMessageHandler(FixtureLoader.LoadText(fixturePath)))
        {
            BaseAddress = new Uri("http://frigate.test/")
        };
        var sut = new FrigateRestClient(httpClient);

        var identity = await sut.TryGetIdentityAsync("frigate-evt-rest", CancellationToken.None);

        Assert.Equal(expectedIdentity, identity);
    }

    [Fact]
    public async Task TryGetIdentityAsync_throws_on_non_success_status_so_breaking_rest_contracts_fail_fast()
    {
        using var httpClient = new HttpClient(new StubHttpMessageHandler("{}", HttpStatusCode.InternalServerError))
        {
            BaseAddress = new Uri("http://frigate.test/")
        };
        var sut = new FrigateRestClient(httpClient);

        await Assert.ThrowsAsync<HttpRequestException>(() => sut.TryGetIdentityAsync("frigate-evt-rest", CancellationToken.None));
    }
}

internal static class FixtureLoader
{
    public static string LoadText(string relativePath)
    {
        var fullPath = Path.Combine(AppContext.BaseDirectory, "Contracts", "Fixtures", relativePath.Replace('/', Path.DirectorySeparatorChar));
        return File.ReadAllText(fullPath);
    }
}

internal sealed class StubHttpMessageHandler(string responseBody, HttpStatusCode statusCode = HttpStatusCode.OK) : HttpMessageHandler
{
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        => Task.FromResult(new HttpResponseMessage(statusCode)
        {
            Content = new StringContent(responseBody, Encoding.UTF8, "application/json")
        });
}