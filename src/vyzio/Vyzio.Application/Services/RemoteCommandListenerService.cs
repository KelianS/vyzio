using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Vyzio.Application.UseCases.Commands;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.Services;

/// <summary>
/// One retrieval loop per configured inbound channel, started and stopped with its configuration
/// (ADR-52). Nothing here knows how a channel listens — only that it does.
/// </summary>
internal sealed class RemoteCommandListenerService(
    IChannelCommandReceiverCatalog receivers,
    IServiceScopeFactory scopeFactory,
    IChannelListenerHealth health,
    ILogger<RemoteCommandListenerService> logger) : BackgroundService
{
    private static readonly TimeSpan ReconciliationInterval = TimeSpan.FromSeconds(10);
    private static readonly TimeSpan RetryDelay = TimeSpan.FromSeconds(15);

    private readonly Dictionary<NotificationChannel, Listener> _listeners = [];

    private sealed record Listener(CancellationTokenSource Stop, Task Loop, DateTimeOffset? ConfiguredAt);

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try
            {
                await ReconcileAsync(ct);
                await Task.Delay(ReconciliationInterval, ct);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                logger.LogError(exception, "Could not reconcile the inbound channels.");
                await Task.Delay(ReconciliationInterval, CancellationToken.None);
            }
        }

        foreach (var listener in _listeners.Values)
            await listener.Stop.CancelAsync();
    }

    /// <summary>Brings the running loops in line with the configuration — a saved credential restarts one.</summary>
    private async Task ReconcileAsync(CancellationToken ct)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var catalog = scope.ServiceProvider.GetRequiredService<INotificationChannelCatalog>();
        var configs = await scope.ServiceProvider
            .GetRequiredService<INotificationChannelConfigRepository>()
            .GetAllAsync(ct);

        var wanted = configs
            .Where(config => config.IsEnabled
                             && catalog.Describe(config.Channel)?.CanListen(config.Credentials) == true
                             && receivers.ReceiverFor(config.Channel) is not null)
            .ToDictionary(config => config.Channel);

        foreach (var (channel, listener) in _listeners.ToList())
        {
            var stillWanted = wanted.TryGetValue(channel, out var config)
                              && config.ConfiguredAt == listener.ConfiguredAt
                              && !listener.Loop.IsCompleted;
            if (stillWanted) continue;

            await listener.Stop.CancelAsync();
            listener.Stop.Dispose();
            _listeners.Remove(channel);
            health.Stopped(channel);
            logger.LogInformation("Stopped listening for commands on {Channel}.", channel);
        }

        foreach (var (channel, config) in wanted)
        {
            if (_listeners.ContainsKey(channel)) continue;

            var stop = CancellationTokenSource.CreateLinkedTokenSource(ct);
            var receiver = receivers.ReceiverFor(channel)!;
            var loop = ListenAsync(receiver, config.Credentials, stop.Token);

            _listeners[channel] = new Listener(stop, loop, config.ConfiguredAt);
            logger.LogInformation("Listening for commands on {Channel}.", channel);
        }
    }

    private async Task ListenAsync(IChannelCommandReceiver receiver, ChannelCredentials credentials, CancellationToken ct)
    {
        var commands = Descriptors();

        try
        {
            await receiver.PublishCommandsAsync(commands, credentials, ct);
        }
        catch (Exception exception) when (!ct.IsCancellationRequested)
        {
            // Not fatal: the commands still run, the user just has to type them instead of picking them.
            logger.LogWarning(exception, "Could not publish the commands on {Channel}.", receiver.Channel);
        }

        health.Started(receiver.Channel);

        while (!ct.IsCancellationRequested)
        {
            try
            {
                foreach (var incoming in await receiver.ReceiveAsync(commands, credentials, ct))
                    await HandleAsync(receiver, incoming, credentials, ct);

                // A round that comes back is the proof the channel is still heard, and the only one.
                health.Started(receiver.Channel);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                health.Interrupted(receiver.Channel, exception.Message);
                logger.LogWarning(exception, "The command loop of {Channel} was interrupted.", receiver.Channel);
                try
                {
                    await Task.Delay(RetryDelay, ct);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
            }
        }
    }

    private async Task HandleAsync(
        IChannelCommandReceiver receiver,
        IncomingMessage incoming,
        ChannelCredentials credentials,
        CancellationToken ct)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var handle = scope.ServiceProvider.GetRequiredService<HandleIncomingCommandUseCase>();

        var result = await handle.ExecuteAsync(incoming, ct);
        try
        {
            await receiver.RespondAsync(incoming.Origin, result, Descriptors(), credentials, ct);
        }
        finally
        {
            if (result.Photo is { } photo) await photo.DisposeAsync();
        }
    }

    private IReadOnlyList<RemoteCommandDescriptor> Descriptors()
    {
        using var scope = scopeFactory.CreateScope();
        return scope.ServiceProvider.GetRequiredService<IRemoteCommandRegistry>().Descriptors;
    }
}
