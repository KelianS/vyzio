using System.Net.Sockets;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.Services;

internal sealed class CameraReachabilityPollerService(
    IServiceScopeFactory scopeFactory,
    TimeProvider time,
    ILogger<CameraReachabilityPollerService> logger) : BackgroundService
{
    private static readonly TimeSpan PollInterval = TimeSpan.FromSeconds(60);
    private static readonly TimeSpan TcpTimeout = TimeSpan.FromSeconds(3);
    private static readonly TimeSpan StartupDelay = TimeSpan.FromSeconds(15);

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        await Task.Delay(StartupDelay, time, ct);

        while (!ct.IsCancellationRequested)
        {
            try
            {
                await PollAllAsync(ct);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Camera reachability poll failed; will retry next interval.");
            }

            await Task.Delay(PollInterval, time, ct);
        }
    }

    private async Task PollAllAsync(CancellationToken ct)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var cameras = scope.ServiceProvider.GetRequiredService<ICameraRepository>();

        var all = await cameras.GetAllAsync(ct);
        var toProbe = all.Where(c => c.ValidationState == CameraValidationState.Validated).ToList();

        foreach (var camera in toProbe)
        {
            if (ct.IsCancellationRequested) break;

            var newStatus = await ProbeAsync(camera.Host, camera.Port, ct);

            if (!string.Equals(camera.Status, newStatus, StringComparison.Ordinal))
            {
                logger.LogInformation(
                    "Camera {CameraId} ({Host}:{Port}) status changed: {Old} → {New}.",
                    camera.Id, camera.Host, camera.Port, camera.Status, newStatus);

                camera.Status = newStatus;
                camera.LastReachabilityCheckAt = time.GetUtcNow();
                await cameras.UpdateAsync(camera, ct);
            }
        }
    }

    private async Task<string> ProbeAsync(string host, int port, CancellationToken appCt)
    {
        try
        {
            using var timeout = new CancellationTokenSource(TcpTimeout, time);
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(appCt, timeout.Token);
            using var tcp = new TcpClient();
            await tcp.ConnectAsync(host, port, cts.Token);
            return "online";
        }
        catch (OperationCanceledException) when (appCt.IsCancellationRequested)
        {
            throw;
        }
        catch
        {
            return "offline";
        }
    }
}
