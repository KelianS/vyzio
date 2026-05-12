using Microsoft.EntityFrameworkCore;
using Vyzio.Application.DependencyInjection;
using Vyzio.Api.Endpoints;
using Vyzio.Api.Integration.Frigate;
using Vyzio.Infrastructure.Configuration;
using Vyzio.Infrastructure.DependencyInjection;
using Vyzio.Infrastructure.Notifications;
using Vyzio.Infrastructure.Persistence;
using Vyzio.Core.Interfaces;

var builder = WebApplication.CreateBuilder(args);

var configPath = builder.Configuration["VYZIO_CONFIG_PATH"]
	?? Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath, "..", "..", "..", "config", "vyzio.yml"));

var runtimeSettings = VyzioConfigLoader.Load(configPath);
builder.Services.AddVyzioInfrastructure(runtimeSettings);
builder.Services.AddVyzioApplication(
	runtimeSettings.Frigate.RetainedLabels,
	runtimeSettings.Notifications.Telegram.IsEnabled,
	runtimeSettings.Notifications.MinimumConfidence);
builder.Services.AddHttpClient<IFrigateRestClient, FrigateRestClient>(client =>
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
}

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
app.MapGet("/", () => Results.Ok(new { service = "vyzio-api", config = configPath }));
app.MapHub();
app.MapCameras();
app.MapDetectionEvents();
app.MapProfiles();

app.Run();

public partial class Program;
