using Microsoft.Extensions.Logging;
using MQTTnet;
using MQTTnet.Protocol;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.Configuration;

namespace Vyzio.Infrastructure.Services;

// Applies a sensitivity level to a running Frigate over MQTT (ADR-35). Frigate exposes
// motion_contour_area as a runtime command, so a level change costs no config rewrite and no
// restart — which is what makes an auto-tuning loop viable at all.
//
// Connects per call rather than holding a long-lived client: level changes are rare by design
// (rate-limited by the tuning loop), so an idle connection would cost more than it saves.
public sealed class FrigateMotionSettingsPublisher(
    VyzioRuntimeSettings settings,
    ILogger<FrigateMotionSettingsPublisher> logger) : IFrigateMotionSettingsPublisher
{
    // The two scales run in opposite directions: more sensitive means a SMALLER minimum contour.
    // Values are Frigate's own documented reference points for high/medium/low sensitivity.
    private static readonly IReadOnlyDictionary<MotionSensitivity, int> ContourAreas =
        new Dictionary<MotionSensitivity, int>
        {
            [MotionSensitivity.High] = 10,
            [MotionSensitivity.Medium] = 30,
            [MotionSensitivity.Low] = 50,
        };

    public static int ToContourArea(MotionSensitivity sensitivity) => ContourAreas[sensitivity];

    public async Task<bool> TryPublishSensitivityAsync(
        string frigateCameraName,
        MotionSensitivity sensitivity,
        CancellationToken ct = default)
    {
        var topic = $"frigate/{frigateCameraName}/motion_contour_area/set";
        var payload = ToContourArea(sensitivity).ToString();

        try
        {
            var factory = new MqttClientFactory();
            using var client = factory.CreateMqttClient();

            var options = new MqttClientOptionsBuilder()
                .WithClientId($"{settings.Frigate.Mqtt.ClientId}-motion")
                .WithTcpServer(settings.Frigate.Mqtt.Host, settings.Frigate.Mqtt.Port)
                .Build();

            await client.ConnectAsync(options, ct);

            var message = new MqttApplicationMessageBuilder()
                .WithTopic(topic)
                .WithPayload(payload)
                .WithQualityOfServiceLevel(MqttQualityOfServiceLevel.AtLeastOnce)
                .Build();

            await client.PublishAsync(message, ct);
            await client.DisconnectAsync(new MqttClientDisconnectOptions(), ct);

            logger.LogInformation(
                "Motion sensitivity for {Camera} set to {Sensitivity} (contour_area {ContourArea}).",
                frigateCameraName, sensitivity, payload);
            return true;
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            // Never fatal: the persisted level still reaches Frigate on the next config write.
            logger.LogWarning(ex, "Could not publish motion sensitivity for {Camera}.", frigateCameraName);
            return false;
        }
    }
}
