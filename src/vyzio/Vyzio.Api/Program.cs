using Microsoft.EntityFrameworkCore;
using Vyzio.Application.DependencyInjection;
using Vyzio.Api.Endpoints;
using Vyzio.Infrastructure.Configuration;
using Vyzio.Infrastructure.DependencyInjection;
using Vyzio.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);

var configPath = builder.Configuration["VYZIO_CONFIG_PATH"]
	?? Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath, "..", "..", "..", "config", "vyzio.yml"));

var runtimeSettings = VyzioConfigLoader.Load(configPath);
builder.Services.AddVyzioInfrastructure(runtimeSettings);
builder.Services.AddVyzioApplication();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
	var dbContext = scope.ServiceProvider.GetRequiredService<VyzioDbContext>();
	dbContext.Database.Migrate();
}

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
app.MapGet("/", () => Results.Ok(new { service = "vyzio-api", config = configPath }));
app.MapProfiles();

app.Run();
