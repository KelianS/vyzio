using Microsoft.EntityFrameworkCore;
using Vyzio.Application.DependencyInjection;
using Vyzio.Application.Options;
using Vyzio.Api.Endpoints;
using Vyzio.Api.Integration.Frigate;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.Services;
using Vyzio.Infrastructure.Configuration;
using Vyzio.Infrastructure.DependencyInjection;
using Vyzio.Infrastructure.Notifications;
using Vyzio.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);

var configPath = builder.Configuration["VYZIO_CONFIG_PATH"]
    ?? Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath, "..", "..", "..", "config", "vyzio.yml"));

var runtimeSettings = VyzioConfigLoader.Load(configPath);

var connStr = runtimeSettings.Database.ConnectionString;
var dataSource = connStr.Split(';', StringSplitOptions.RemoveEmptyEntries)
    .Select(p => p.Trim())
    .FirstOrDefault(p => p.StartsWith("Data Source=", StringComparison.OrdinalIgnoreCase))
    ?? $"Data Source={connStr}";
var dbFilePath = dataSource["Data Source=".Length..].Trim();
var dataDirectory = Path.GetDirectoryName(Path.GetFullPath(dbFilePath)) ?? Path.GetFullPath("./data");

builder.Services.AddSingleton(new FaceStorageOptions(dataDirectory));
builder.Services.AddVyzioInfrastructure(runtimeSettings);
builder.Services.AddVyzioApplication(runtimeSettings.Frigate.RetainedLabels);
builder.Services.AddHttpClient<IFrigateRestClient, FrigateRestClient>(client =>
{
    client.BaseAddress = new Uri($"{runtimeSettings.Frigate.ApiBaseUrl}/");
});
builder.Services.AddHttpClient<IFrigateSnapshotProvider, FrigateSnapshotProvider>(client =>
{
    client.BaseAddress = new Uri($"{runtimeSettings.Frigate.ApiBaseUrl}/");
});
builder.Services.AddHttpClient<IFrigateFaceLibrary, FrigateFaceLibraryClient>(client =>
{
    client.BaseAddress = new Uri($"{runtimeSettings.Frigate.ApiBaseUrl}/");
});
builder.Services.AddHttpClient<ITelegramNotificationSender, TelegramNotificationSender>();
builder.Services.AddScoped<FrigateAdapter>();
builder.Services.AddHostedService<FrigateMqttIngressService>();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<VyzioDbContext>();
    dbContext.Database.Migrate();

    // Seed telegram config from vyzio.yml if no DB config exists yet
    var channelConfigs = scope.ServiceProvider.GetRequiredService<INotificationChannelConfigRepository>();
    var existing = await channelConfigs.GetByChannelAsync("telegram");
    if (existing is null)
    {
        var telegram = runtimeSettings.Notifications.Telegram;
        var seeded = new NotificationChannelConfig
        {
            Channel = "telegram",
            IsEnabled = telegram.IsEnabled,
            BotToken = string.IsNullOrWhiteSpace(telegram.BotToken) ? null : telegram.BotToken,
            ChatId = string.IsNullOrWhiteSpace(telegram.ChatId) ? null : telegram.ChatId,
            MinimumConfidence = runtimeSettings.Notifications.MinimumConfidence,
            ConfiguredAt = telegram.IsEnabled ? DateTimeOffset.UtcNow : null
        };
        await channelConfigs.UpsertAsync(seeded);
    }
}

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
app.MapGet("/", () => Results.Ok(new { service = "vyzio-api", config = configPath }));
app.MapHub();
app.MapCameras();
app.MapDetectionEvents();
app.MapProfiles();
app.MapNotifications();

app.Run();

public partial class Program;
