using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Vyzio.Application.DependencyInjection;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Application.Options;
using Vyzio.Api.Access;
using Vyzio.Api.Endpoints;
using Vyzio.Api.Integration.Frigate;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.Services;
using Vyzio.Infrastructure.Configuration;
using Vyzio.Infrastructure.DependencyInjection;
using Vyzio.Infrastructure.Notifications;
using Vyzio.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);

var runtimeSettings = VyzioConfigLoader.Load();

var connStr = runtimeSettings.Database.ConnectionString;
var dataSource = connStr.Split(';', StringSplitOptions.RemoveEmptyEntries)
    .Select(p => p.Trim())
    .FirstOrDefault(p => p.StartsWith("Data Source=", StringComparison.OrdinalIgnoreCase))
    ?? $"Data Source={connStr}";
var dbFilePath = dataSource["Data Source=".Length..].Trim();
var dataDirectory = Path.GetDirectoryName(Path.GetFullPath(dbFilePath)) ?? Path.GetFullPath("./data");

builder.Services.AddSingleton(new FaceStorageOptions(dataDirectory));
builder.Services.AddSingleton<IPtzThumbnailStore>(
    new Vyzio.Infrastructure.Services.FilePtzThumbnailStore(
        Path.Combine(dataDirectory, "ptz-thumbnails")));
builder.Services.AddVyzioInfrastructure(runtimeSettings);
var appTimeZone = string.IsNullOrWhiteSpace(runtimeSettings.TimeZone)
    ? TimeZoneInfo.Local
    : TimeZoneInfo.FindSystemTimeZoneById(runtimeSettings.TimeZone);
builder.Services.AddVyzioApplication(runtimeSettings.Frigate.RetainedLabels, appTimeZone);
builder.Services.AddHttpClient<IFrigateEventReader, FrigateEventReader>(client =>
{
    client.BaseAddress = new Uri($"{runtimeSettings.Frigate.ApiBaseUrl}/");
});
builder.Services.AddHttpClient<IFrigateLiveFrameProvider, FrigateLiveFrameProvider>(client =>
{
    client.BaseAddress = new Uri($"{runtimeSettings.Frigate.ApiBaseUrl}/");
});
builder.Services.AddHttpClient<IFrigateIdentityWriter, FrigateIdentityWriter>(client =>
{
    client.BaseAddress = new Uri($"{runtimeSettings.Frigate.ApiBaseUrl}/");
});
builder.Services.AddHttpClient<IFrigateEventImageProvider, FrigateEventImageProvider>(client =>
{
    client.BaseAddress = new Uri($"{runtimeSettings.Frigate.ApiBaseUrl}/");
});
builder.Services.AddHttpClient<IFrigateClipProvider, FrigateClipProvider>(client =>
{
    client.BaseAddress = new Uri($"{runtimeSettings.Frigate.ApiBaseUrl}/");
});
builder.Services.AddHttpClient<IFrigateStatsProvider, FrigateStatsProvider>(client =>
{
    client.BaseAddress = new Uri($"{runtimeSettings.Frigate.ApiBaseUrl}/");
});
builder.Services.AddHttpClient<IFrigateFaceLibrary, FrigateFaceLibraryClient>(client =>
{
    client.BaseAddress = new Uri($"{runtimeSettings.Frigate.ApiBaseUrl}/");
});
// One typed client per channel adapter, then the catalog over all of them (ADR-50).
builder.Services.AddHttpClient<TelegramNotificationSender>();
builder.Services.AddHttpClient<DiscordNotificationSender>();
builder.Services.AddTransient<INotificationChannelSender>(sp => sp.GetRequiredService<TelegramNotificationSender>());
builder.Services.AddTransient<INotificationChannelSender>(sp => sp.GetRequiredService<DiscordNotificationSender>());
builder.Services.AddScoped<INotificationChannelCatalog, NotificationChannelCatalog>();
// Singleton: a receiver carries what outlives a poll — an acknowledged position, an open connection (ADR-52).
builder.Services.AddSingleton<IChannelCommandReceiver, TelegramCommandReceiver>();
builder.Services.AddSingleton<IChannelCommandReceiver, DiscordCommandReceiver>();
builder.Services.AddSingleton<IChannelCommandReceiverCatalog, ChannelCommandReceiverCatalog>();
// The barrier: one scheme, one cookie, sessions the server can revoke (ADR-54).
builder.Services
    .AddAuthentication(SessionAuthentication.Scheme)
    .AddScheme<AuthenticationSchemeOptions, SessionAuthenticationHandler>(SessionAuthentication.Scheme, null);
// Guarded unless a route says otherwise: a barrier that must be remembered per route is one that gets
// forgotten, and the route we forget is the one that leaks (ADR-54).
builder.Services.AddAuthorization(options =>
    options.FallbackPolicy = new AuthorizationPolicyBuilder(SessionAuthentication.Scheme)
        .RequireAuthenticatedUser()
        .Build());

// Only the doors that take a password: rate limiting the rest would throttle the interface itself.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy(AccessEndpoints.SignInRateLimitPolicy, context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(5)
            }));
});

builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<Vyzio.Api.FrigateUnavailableExceptionHandler>();
builder.Services.AddHostedService<FrigateMqttIngressService>();
builder.Services.AddHostedService<PrivacySchedulerService>();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<VyzioDbContext>();
    dbContext.Database.Migrate();

}

app.UseExceptionHandler();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

// The container probe: it must answer before anyone has installed anything.
app.MapGet("/health", () => Results.Ok(new { status = "ok" })).AllowAnonymous();
app.MapGet("/", () => Results.Ok(new { service = "vyzio-api" })).AllowAnonymous();
app.MapAccess();
app.MapHub();
app.MapDetectionLabels();
app.MapCameras();
app.MapDetectionEvents();
app.MapProfiles();
app.MapNotifications();
app.MapSystem();
app.MapSettings();

app.Run();

public partial class Program;
