using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Vyzio.Application.DTOs.Access;
using Vyzio.Core.Entities;
using Vyzio.Infrastructure.Configuration;
using Vyzio.Infrastructure.Persistence;

namespace Vyzio.Tests.Integration;

public class AccessEndpointsTests : IClassFixture<AccessApiFactory>
{
    private const string Password = "un-mot-de-passe";

    private readonly AccessApiFactory _factory;

    public AccessEndpointsTests(AccessApiFactory factory)
    {
        _factory = factory;
        _factory.ResetState();
    }

    [Fact]
    public async Task A_fresh_install_says_it_has_no_owner_yet()
    {
        using var client = _factory.CreateClient();

        var state = await client.GetFromJsonAsync<AccessStateDto>("/api/access/state");

        Assert.NotNull(state);
        Assert.False(state!.Installed);
        Assert.Equal(Account.MinimumPasswordLength, state.MinimumPasswordLength);
    }

    [Fact]
    public async Task Creating_the_owner_opens_a_session_straight_away()
    {
        using var client = _factory.CreateClient();

        var created = await client.PostAsJsonAsync("/api/access/account", new PasswordRequest(Password));

        created.EnsureSuccessStatusCode();
        var session = await created.Content.ReadFromJsonAsync<CurrentSessionDto>();
        Assert.Equal("owner", session!.Role);

        // The cookie the response set is enough to be someone on the next request.
        var current = await client.GetAsync("/api/access/session");
        Assert.Equal(HttpStatusCode.OK, current.StatusCode);

        var state = await client.GetFromJsonAsync<AccessStateDto>("/api/access/state");
        Assert.True(state!.Installed);
    }

    [Fact]
    public async Task A_second_owner_cannot_be_created()
    {
        using var client = _factory.CreateClient();
        await client.PostAsJsonAsync("/api/access/account", new PasswordRequest(Password));

        var again = await client.PostAsJsonAsync("/api/access/account", new PasswordRequest("un-autre-mot"));

        Assert.Equal(HttpStatusCode.Conflict, again.StatusCode);
    }

    [Fact]
    public async Task A_password_too_short_is_refused_before_anything_is_created()
    {
        using var client = _factory.CreateClient();

        var created = await client.PostAsJsonAsync("/api/access/account", new PasswordRequest("court"));

        Assert.Equal(HttpStatusCode.BadRequest, created.StatusCode);
        var state = await client.GetFromJsonAsync<AccessStateDto>("/api/access/state");
        Assert.False(state!.Installed);
    }

    [Fact]
    public async Task Signing_in_needs_the_right_password()
    {
        using var owner = _factory.CreateClient();
        await owner.PostAsJsonAsync("/api/access/account", new PasswordRequest(Password));

        using var client = _factory.CreateClient();
        var wrong = await client.PostAsJsonAsync("/api/access/session", new PasswordRequest("pas-le-bon-mot"));
        Assert.Equal(HttpStatusCode.Unauthorized, wrong.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/access/session")).StatusCode);

        var right = await client.PostAsJsonAsync("/api/access/session", new PasswordRequest(Password));
        Assert.Equal(HttpStatusCode.OK, right.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/access/session")).StatusCode);
    }

    [Fact]
    public async Task Signing_out_closes_the_session_it_was_holding()
    {
        using var client = _factory.CreateClient();
        await client.PostAsJsonAsync("/api/access/account", new PasswordRequest(Password));

        var out_ = await client.DeleteAsync("/api/access/session");

        Assert.Equal(HttpStatusCode.NoContent, out_.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/access/session")).StatusCode);
    }

    [Fact]
    public async Task Signing_out_everywhere_closes_the_devices_that_were_left_open()
    {
        using var phone = _factory.CreateClient();
        await phone.PostAsJsonAsync("/api/access/account", new PasswordRequest(Password));

        using var laptop = _factory.CreateClient();
        await laptop.PostAsJsonAsync("/api/access/session", new PasswordRequest(Password));
        Assert.Equal(HttpStatusCode.OK, (await laptop.GetAsync("/api/access/session")).StatusCode);

        var closed = await phone.DeleteAsync("/api/access/sessions");

        Assert.Equal(HttpStatusCode.OK, closed.StatusCode);
        // The point of the gesture: the device that is not in the user's hand stops opening too.
        Assert.Equal(HttpStatusCode.Unauthorized, (await laptop.GetAsync("/api/access/session")).StatusCode);
    }

    [Fact]
    public async Task An_expired_session_stops_opening()
    {
        using var client = _factory.CreateClient();
        await client.PostAsJsonAsync("/api/access/account", new PasswordRequest(Password));

        _factory.Expire();

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/access/session")).StatusCode);
    }

    [Fact]
    public async Task A_cookie_that_matches_nothing_opens_nothing()
    {
        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("Cookie", "vyzio_session=deadbeef");

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/access/session")).StatusCode);
    }
}

public sealed class AccessApiFactory : WebApplicationFactory<Program>
{
    private readonly SqliteConnection _connection = new("Data Source=:memory:");

    public void ResetState()
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<VyzioDbContext>();

        db.Sessions.RemoveRange(db.Sessions);
        db.Accounts.RemoveRange(db.Accounts);
        db.SaveChanges();
    }

    /// <summary>Ages every open session past its window — the only way to test a month-long lifetime.</summary>
    public void Expire()
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<VyzioDbContext>();

        foreach (var session in db.Sessions)
            session.ExpiresAt = DateTimeOffset.UtcNow.AddMinutes(-1);

        db.SaveChanges();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");

        builder.ConfigureServices(services =>
        {
            _connection.Open();

            services.RemoveAll<IHostedService>();
            services.RemoveAll<DbContextOptions<VyzioDbContext>>();
            services.RemoveAll<VyzioDbContext>();
            services.RemoveAll<VyzioRuntimeSettings>();
            services.AddSingleton(new VyzioRuntimeSettings());

            services.AddDbContext<VyzioDbContext>(options =>
                options.UseSqlite(_connection)
                       .UseSnakeCaseNamingConvention());

            using var scope = services.BuildServiceProvider().CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<VyzioDbContext>();
            db.Database.Migrate();
        });
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing)
        {
            _connection.Dispose();
        }
    }
}
