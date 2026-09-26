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
using Vyzio.Application.UseCases.Access;
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
    public async Task GetAccessState_ShouldReportNoOwner_WhenTheInstallIsFresh()
    {
        using var client = _factory.CreateClient();

        var state = await client.GetFromJsonAsync<AccessStateDto>("/api/access/state");

        Assert.NotNull(state);
        Assert.False(state!.Installed);
        Assert.False(state.AwaitingReset);
        Assert.Equal(Account.MinimumPasswordLength, state.MinimumPasswordLength);
    }

    [Fact]
    public async Task CreateAccount_ShouldOpenASessionStraightAway_WhenTheOwnerIsCreated()
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
    public async Task CreateAccount_ShouldAnswerConflict_WhenAnOwnerAlreadyExists()
    {
        using var client = _factory.CreateClient();
        await client.PostAsJsonAsync("/api/access/account", new PasswordRequest(Password));

        var again = await client.PostAsJsonAsync("/api/access/account", new PasswordRequest("un-autre-mot"));

        Assert.Equal(HttpStatusCode.Conflict, again.StatusCode);
    }

    [Fact]
    public async Task CreateAccount_ShouldRefuseBeforeCreatingAnything_WhenThePasswordIsTooShort()
    {
        using var client = _factory.CreateClient();

        var created = await client.PostAsJsonAsync("/api/access/account", new PasswordRequest("court"));

        Assert.Equal(HttpStatusCode.BadRequest, created.StatusCode);
        var state = await client.GetFromJsonAsync<AccessStateDto>("/api/access/state");
        Assert.False(state!.Installed);
    }

    [Fact]
    public async Task SignIn_ShouldOpenASessionOnlyWithTheRightPassword_WhenAWrongOneIsTriedFirst()
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
    public async Task SignOut_ShouldCloseTheSession_WhenTheDeviceHoldsOne()
    {
        using var client = _factory.CreateClient();
        await client.PostAsJsonAsync("/api/access/account", new PasswordRequest(Password));

        var out_ = await client.DeleteAsync("/api/access/session");

        Assert.Equal(HttpStatusCode.NoContent, out_.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/access/session")).StatusCode);
    }

    [Fact]
    public async Task SignOutEverywhere_ShouldCloseTheOtherDevices_WhenTheyWereLeftOpen()
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
    public async Task GetSession_ShouldAnswerUnauthorized_WhenTheSessionHasExpired()
    {
        using var client = _factory.CreateClient();
        await client.PostAsJsonAsync("/api/access/account", new PasswordRequest(Password));

        _factory.Expire();

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/access/session")).StatusCode);
    }

    [Fact]
    public async Task ChangePassword_ShouldRefuseAndKeepTheSession_WhenTheCurrentPasswordIsWrong()
    {
        using var client = _factory.CreateClient();
        await client.PostAsJsonAsync("/api/access/account", new PasswordRequest(Password));

        var refused = await client.PutAsJsonAsync(
            "/api/access/password", new ChangePasswordRequest("pas-le-bon-mot", "un-nouveau-mot"));

        // Not 401: the caller is signed in, and the interface reads 401 as having been signed out.
        Assert.Equal(HttpStatusCode.BadRequest, refused.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/access/session")).StatusCode);
    }

    [Fact]
    public async Task ChangePassword_ShouldMakeTheNewPasswordTheOnlyOneThatOpens_WhenTheCurrentPasswordIsRight()
    {
        using var client = _factory.CreateClient();
        await client.PostAsJsonAsync("/api/access/account", new PasswordRequest(Password));

        var changed = await client.PutAsJsonAsync(
            "/api/access/password", new ChangePasswordRequest(Password, "un-nouveau-mot"));
        Assert.Equal(HttpStatusCode.OK, changed.StatusCode);

        using var elsewhere = _factory.CreateClient();
        Assert.Equal(
            HttpStatusCode.Unauthorized,
            (await elsewhere.PostAsJsonAsync("/api/access/session", new PasswordRequest(Password))).StatusCode);
        Assert.Equal(
            HttpStatusCode.OK,
            (await elsewhere.PostAsJsonAsync("/api/access/session", new PasswordRequest("un-nouveau-mot"))).StatusCode);
    }

    [Fact]
    public async Task ChangePassword_ShouldCloseTheOtherDevicesButNotTheCaller_WhenSeveralDevicesAreSignedIn()
    {
        using var phone = _factory.CreateClient();
        await phone.PostAsJsonAsync("/api/access/account", new PasswordRequest(Password));

        using var laptop = _factory.CreateClient();
        await laptop.PostAsJsonAsync("/api/access/session", new PasswordRequest(Password));

        await phone.PutAsJsonAsync("/api/access/password", new ChangePasswordRequest(Password, "un-nouveau-mot"));

        // The whole point of changing it: whoever knew the old one is out, including a device left open.
        Assert.Equal(HttpStatusCode.Unauthorized, (await laptop.GetAsync("/api/access/session")).StatusCode);
        // And the person who asked stays where they were, on the session the answer handed back.
        Assert.Equal(HttpStatusCode.OK, (await phone.GetAsync("/api/access/session")).StatusCode);
    }

    [Fact]
    public async Task ResetFromHost_ShouldReopenTheFirstRunScreenAndCloseEveryDevice_WhenAnOwnerExists()
    {
        using var client = _factory.CreateClient();
        await client.PostAsJsonAsync("/api/access/account", new PasswordRequest(Password));

        var reset = _factory.ResetFromHost();

        Assert.NotNull(reset);
        Assert.Equal(1, reset!.SessionsClosed);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/access/session")).StatusCode);

        var state = await client.GetFromJsonAsync<AccessStateDto>("/api/access/state");
        Assert.False(state!.Installed);
        // Told apart from a brand new install, because the screen does not say the same thing to both.
        Assert.True(state.AwaitingReset);
    }

    [Fact]
    public async Task CreateAccount_ShouldKeepTheSameAccount_WhenAPasswordIsChosenAfterAHostReset()
    {
        using var client = _factory.CreateClient();
        await client.PostAsJsonAsync("/api/access/account", new PasswordRequest(Password));
        var before = _factory.OwnerId();

        _factory.ResetFromHost();
        var claimed = await client.PostAsJsonAsync("/api/access/account", new PasswordRequest("un-nouveau-mot"));

        Assert.Equal(HttpStatusCode.OK, claimed.StatusCode);
        // The account is never deleted: its role, and whatever attaches to it later, survive the reset.
        Assert.Equal(before, _factory.OwnerId());
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/access/session")).StatusCode);
    }

    [Fact]
    public async Task CloseResetWindow_ShouldLockTheInstall_WhenNoPasswordWasChosenDuringTheWindow()
    {
        using var client = _factory.CreateClient();
        await client.PostAsJsonAsync("/api/access/account", new PasswordRequest(Password));
        _factory.ResetFromHost();

        _factory.CloseResetWindow();

        var state = await client.GetFromJsonAsync<AccessStateDto>("/api/access/state");
        Assert.True(state!.Installed);
        // Nobody walks in late: neither by claiming the account nor with the password that was removed.
        Assert.Equal(
            HttpStatusCode.Conflict,
            (await client.PostAsJsonAsync("/api/access/account", new PasswordRequest("un-nouveau-mot"))).StatusCode);
        Assert.Equal(
            HttpStatusCode.Unauthorized,
            (await client.PostAsJsonAsync("/api/access/session", new PasswordRequest(Password))).StatusCode);
    }

    [Fact]
    public async Task GetSession_ShouldAnswerUnauthorized_WhenTheCookieMatchesNoSession()
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

    /// <summary>What the host-side command does, run through the very same use case.</summary>
    public PasswordResetDto? ResetFromHost()
    {
        using var scope = Services.CreateScope();
        var useCase = scope.ServiceProvider.GetRequiredService<ResetOwnerPasswordUseCase>();

        return useCase.ExecuteAsync().GetAwaiter().GetResult();
    }

    /// <summary>Ages the reset past its window — the only way to test a half-hour of waiting.</summary>
    public void CloseResetWindow()
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<VyzioDbContext>();

        foreach (var account in db.Accounts)
            account.PasswordForgottenAt = DateTimeOffset.UtcNow - Account.ResetWindow - TimeSpan.FromMinutes(1);

        db.SaveChanges();
    }

    public string? OwnerId()
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<VyzioDbContext>();

        return db.Accounts.Select(account => account.Id).FirstOrDefault();
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
