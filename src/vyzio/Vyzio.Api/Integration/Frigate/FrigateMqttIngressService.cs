using System.Buffers;
using System.Text;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using MQTTnet;
using MQTTnet.Protocol;
using Vyzio.Application.UseCases.Frigate;
using Vyzio.Infrastructure.Configuration;

namespace Vyzio.Api.Integration.Frigate;

public sealed class FrigateMqttIngressService(
    IServiceScopeFactory scopeFactory,
    VyzioRuntimeSettings settings,
    ILogger<FrigateMqttIngressService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var factory = new MqttClientFactory();

        while (!stoppingToken.IsCancellationRequested)
        {
            TaskCompletionSource disconnected = new(TaskCreationOptions.RunContinuationsAsynchronously);
            using var client = factory.CreateMqttClient();

            client.ApplicationMessageReceivedAsync += async args =>
            {
                var payload = Encoding.UTF8.GetString(args.ApplicationMessage.Payload.ToArray());

                using var scope = scopeFactory.CreateScope();
                var ingest = scope.ServiceProvider.GetRequiredService<IngestFrigateEventUseCase>();
                await ingest.ExecuteAsync(args.ApplicationMessage.Topic, payload, stoppingToken);
            };

            client.DisconnectedAsync += _ =>
            {
                disconnected.TrySetResult();
                return Task.CompletedTask;
            };

            try
            {
                var options = new MqttClientOptionsBuilder()
                    .WithClientId(settings.Frigate.Mqtt.ClientId)
                    .WithTcpServer(settings.Frigate.Mqtt.Host, settings.Frigate.Mqtt.Port)
                    .Build();

                await client.ConnectAsync(options, stoppingToken);

                var topicFilter = new MqttTopicFilterBuilder()
                    .WithTopic(settings.Frigate.Mqtt.Topic)
                    .WithQualityOfServiceLevel(MqttQualityOfServiceLevel.AtLeastOnce)
                    .Build();

                await client.SubscribeAsync(topicFilter, stoppingToken);
                logger.LogInformation(
                    "Subscribed to Frigate MQTT topic {Topic} on {Host}:{Port}.",
                    settings.Frigate.Mqtt.Topic,
                    settings.Frigate.Mqtt.Host,
                    settings.Frigate.Mqtt.Port);

                await Task.WhenAny(Task.Delay(Timeout.Infinite, stoppingToken), disconnected.Task);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex,
                    "Frigate MQTT ingress failed against {Host}:{Port}; retrying.",
                    settings.Frigate.Mqtt.Host,
                    settings.Frigate.Mqtt.Port);

                await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
            }
            finally
            {
                if (client.IsConnected)
                {
                    await client.DisconnectAsync(new MqttClientDisconnectOptions(), stoppingToken);
                }
            }
        }
    }
}