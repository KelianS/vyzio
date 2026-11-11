using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Vyzio.Application.DependencyInjection;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Application.Options;
using Vyzio.Api;
using Vyzio.Api.Access;
using Vyzio.Api.Endpoints;
using Vyzio.Api.Health;
using Vyzio.Api.Integration.Frigate;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.Services;
using Vyzio.Infrastructure.Configuration;
using Vyzio.Infrastructure.DependencyInjection;
using Vyzio.Infrastructure.Notifications;
using Vyzio.Infrastructure.Persistence;

// Stripped from what configures the host: the command is a positional argument, which the command
// line configuration provider refuses to parse.
var hostCommand = HostCommands.Match(args);

// Exists before the host so a refused setting or a crash at startup still reaches the log; disposing it flushes.
using var startupLogs = LoggerFactory.Create(logging => logging.AddSimpleConsole(console => console.SingleLine = true));
var startupLogger = startupLogs.CreateLogger("Vyzio.Startup");

try
{
    var (runtimeSettings, settingProblems) = VyzioConfigLoader.Load(Environment.GetEnvironmentVariable);
    if (settingProblems.Count > 0)
    {
        foreach (var problem in settingProblems) startupLogger.LogCritical("Vyzio cannot start: {Problem}", problem);
        return 1;
    }

    var dataDirectory = runtimeSettings.Database.DataDirectory;
    var builder = WebApplication.CreateBuilder(hostCommand is null ? args : args[1..]);

    builder.Services.AddSingleton(new FaceStorageOptions(dataDirectory));
    builder.Services.AddSingleton<IPtzThumbnailStore>(
        new Vyzio.Infrastructure.Services.FilePtzThumbnailStore(
            Path.Combine(dataDirectory, "ptz-thumbnails")));
    builder.Services.AddVyzioInfrastructure(runtimeSettings);
    builder.Services.AddVyzioApplication(runtimeSettings.Frigate.RetainedLabels, runtimeSettings.TimeZone);
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
    builder.Services.AddHttpClient<IFrigateDetectionEraser, FrigateDetectionEraser>(client =>
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
    builder.Services.AddExceptionHandler<Vyzio.Api.CameraCommandExceptionHandler>();
    builder.Services.AddExceptionHandler<Vyzio.Api.DetectionErasureExceptionHandler>();
    builder.Services.AddExceptionHandler<Vyzio.Api.FrigateClipUnreadableExceptionHandler>();
    builder.Services.AddExceptionHandler<Vyzio.Api.ScheduleRuleExceptionHandler>();
    builder.Services.AddVyzioHealthChecks();
    builder.Services.AddSingleton<FrigateMqttConnection>();
    builder.Services.AddHostedService<FrigateMqttIngressService>();
    builder.Services.AddHostedService<PrivacySchedulerService>();

    var app = builder.Build();

    using (var scope = app.Services.CreateScope())
    {
        var dbContext = scope.ServiceProvider.GetRequiredService<VyzioDbContext>();
        await DatabaseMigration.ApplyAsync(dbContext, app.Logger);
    }

    // Everything is wired by now, so a host command runs against the same repositories the API uses.
    if (hostCommand is not null) return await HostCommands.RunAsync(app.Services, hostCommand);

    app.UseExceptionHandler();
    app.UseRateLimiter();
    app.UseAuthentication();
    app.UseAuthorization();
    // The live view's socket (ADR-72); pings keep an idle stream open through the dashboard's proxy.
    app.UseWebSockets(new WebSocketOptions { KeepAliveInterval = TimeSpan.FromSeconds(20) });

    // The container probes: they must answer before anyone has installed anything.
    app.MapHealth();
    app.MapGet("/", () => Results.Ok(new { service = "vyzio-api" })).AllowAnonymous();
    app.MapAccess();
    app.MapHub();
    app.MapDetectionLabels();
    app.MapCameras();
    app.MapCameraStreams();
    app.MapDetectionEvents();
    app.MapProfiles();
    app.MapNotifications();
    app.MapSystem();
    app.MapSettings();
    app.MapSchedules();

    await app.RunAsync();

    return 0;
}
// The tooling that builds the host to inspect it stops it this way; that is not a failure to start.
catch (Exception ex) when (ex is not HostAbortedException)
{
    startupLogger.LogCritical(ex, "Vyzio stopped: it could not start or could not keep running");
    return 1;
}

public partial class Program;
