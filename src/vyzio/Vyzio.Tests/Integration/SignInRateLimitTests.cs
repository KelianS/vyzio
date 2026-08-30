using System.Net;
using System.Net.Http.Json;
using Vyzio.Application.DTOs.Access;

namespace Vyzio.Tests.Integration;

/// <summary>
/// Its own installation on purpose: the limit counts per address, so sharing a factory with the other
/// access tests would spend their budget and fail them instead.
/// </summary>
public class SignInRateLimitTests : IClassFixture<AccessApiFactory>
{
    private readonly AccessApiFactory _factory;

    public SignInRateLimitTests(AccessApiFactory factory)
    {
        _factory = factory;
        _factory.ResetState();
    }

    [Fact]
    public async Task Guessing_the_password_in_a_burst_stops_being_answered()
    {
        using var client = _factory.CreateClient();
        await client.PostAsJsonAsync("/api/access/account", new PasswordRequest("un-mot-de-passe"));

        var statuses = new List<HttpStatusCode>();
        for (var attempt = 0; attempt < 12; attempt++)
        {
            var response = await client.PostAsJsonAsync("/api/access/session", new PasswordRequest($"essai-{attempt}"));
            statuses.Add(response.StatusCode);
        }

        Assert.Contains(HttpStatusCode.Unauthorized, statuses);
        Assert.Contains(HttpStatusCode.TooManyRequests, statuses);
        // What matters is that guessing stops paying off, not the exact place the door shuts.
        Assert.Equal(HttpStatusCode.TooManyRequests, statuses[^1]);
    }
}
