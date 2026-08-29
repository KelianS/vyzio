using System.Net;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace Vyzio.Tests.Integration;

/// <summary>
/// Walks what the API actually exposes and fails if anything answers without a session. This is the
/// test that catches the next route somebody adds without thinking about it (ADR-54).
/// </summary>
public class EveryRouteIsGuardedTests : IClassFixture<AccessApiFactory>
{
    private readonly AccessApiFactory _factory;

    /// <summary>
    /// The only doors that open to a stranger, each for a stated reason: the container probe, and the
    /// routes one needs before being able to sign in at all. Nothing else belongs here.
    /// </summary>
    private static readonly HashSet<string> Anonymous =
    [
        "/",
        "/health",
        "/api/access/state",
        "POST /api/access/account",
        "POST /api/access/session",
        "DELETE /api/access/session"
    ];

    public EveryRouteIsGuardedTests(AccessApiFactory factory)
    {
        _factory = factory;
        _factory.ResetState();
    }

    [Fact]
    public async Task No_route_answers_without_a_session_unless_it_is_a_named_exception()
    {
        using var client = _factory.CreateClient();
        var unguarded = new List<string>();

        foreach (var (method, template) in ExposedRoutes())
        {
            if (Anonymous.Contains(template) || Anonymous.Contains($"{method} {template}")) continue;

            using var request = new HttpRequestMessage(new HttpMethod(method), Fill(template));
            var response = await client.SendAsync(request);

            // Authorization runs before the handler, so nothing is executed on the way to this answer.
            if (response.StatusCode != HttpStatusCode.Unauthorized)
                unguarded.Add($"{method} {template} answered {(int)response.StatusCode}");
        }

        Assert.Empty(unguarded);
    }

    [Fact]
    public void Every_named_exception_still_exists()
    {
        var exposed = ExposedRoutes()
            .SelectMany(route => new[] { route.Template, $"{route.Method} {route.Template}" })
            .ToHashSet();

        // An exception left behind for a route that no longer exists quietly widens the list.
        Assert.DoesNotContain(Anonymous, entry => !exposed.Contains(entry));
    }

    private IEnumerable<(string Method, string Template)> ExposedRoutes()
    {
        var endpoints = _factory.Services.GetRequiredService<EndpointDataSource>().Endpoints;

        foreach (var endpoint in endpoints.OfType<RouteEndpoint>())
        {
            var methods = endpoint.Metadata.GetMetadata<IHttpMethodMetadata>()?.HttpMethods ?? ["GET"];
            var template = "/" + endpoint.RoutePattern.RawText?.TrimStart('/');

            foreach (var method in methods)
                yield return (method, template);
        }
    }

    /// <summary>Any value will do: the request never reaches the handler that would read it.</summary>
    private static string Fill(string template)
        => Regex.Replace(template, "{[^}]+}", "probe", RegexOptions.None, TimeSpan.FromSeconds(1));
}
