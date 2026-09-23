using System.Text.Json;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Vyzio.Api.Integration.Frigate;
using Vyzio.Application.UseCases.Monitoring;
using Vyzio.Core.Entities;
using Vyzio.Infrastructure.Persistence;

namespace Vyzio.Api.Health;

public static class HealthEndpoints
{
    private const string Readiness = "ready";
    private static readonly TimeSpan CheckTimeout = TimeSpan.FromSeconds(3);

    public static IServiceCollection AddVyzioHealthChecks(this IServiceCollection services)
    {
        services.AddHealthChecks()
            .AddDbContextCheck<VyzioDbContext>("database", tags: [Readiness])
            .AddCheck<MqttHealthCheck>("mqtt", tags: [Readiness])
            .AddCheck<FrigateHealthCheck>("frigate", tags: [Readiness]);
        services.Configure<HealthCheckServiceOptions>(options =>
        {
            foreach (var registration in options.Registrations) registration.Timeout = CheckTimeout;
        });
        return services;
    }

    // Liveness answers for the process alone, so a Frigate restart never marks the API container unhealthy.
    public static void MapHealth(this IEndpointRouteBuilder app)
    {
        app.MapHealthChecks("/health", new HealthCheckOptions { Predicate = _ => false, ResponseWriter = WriteAsync })
            .WithMetadata(new HttpMethodMetadata(["GET"]))
            .AllowAnonymous();
        app.MapHealthChecks("/health/ready", new HealthCheckOptions
        {
            Predicate = check => check.Tags.Contains(Readiness),
            ResponseWriter = WriteAsync,
        }).WithMetadata(new HttpMethodMetadata(["GET"])).AllowAnonymous();
    }

    // Status words only: a probe anyone on the network can call must not describe the installation.
    private static Task WriteAsync(HttpContext context, HealthReport report)
    {
        context.Response.ContentType = "application/json";
        return context.Response.WriteAsync(JsonSerializer.Serialize(new
        {
            status = Word(report.Status),
            checks = report.Entries.ToDictionary(entry => entry.Key, entry => Word(entry.Value.Status)),
        }));
    }

    private static string Word(HealthStatus status) => status switch
    {
        HealthStatus.Healthy => "healthy",
        HealthStatus.Degraded => "degraded",
        _ => "unhealthy",
    };
}

internal sealed class MqttHealthCheck(FrigateMqttConnection connection) : IHealthCheck
{
    public Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default) =>
        Task.FromResult(connection.IsSubscribed ? HealthCheckResult.Healthy() : HealthCheckResult.Unhealthy());
}

// A restart Vyzio asked for is degraded, not down (ADR-33).
internal sealed class FrigateHealthCheck(FrigateStatusReader frigate) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        var (status, _) = await frigate.ReadAsync(cancellationToken);
        return status switch
        {
            FrigateStatus.Active => HealthCheckResult.Healthy(),
            FrigateStatus.Restarting => HealthCheckResult.Degraded(),
            _ => HealthCheckResult.Unhealthy(),
        };
    }
}
