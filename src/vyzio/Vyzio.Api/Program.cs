using Microsoft.EntityFrameworkCore;
using Vyzio.Application.DependencyInjection;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Application.Options;
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

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
app.MapGet("/", () => Results.Ok(new { service = "vyzio-api" }));
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
