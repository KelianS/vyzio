namespace Vyzio.Infrastructure.Configuration;

public class VyzioRuntimeSettings
{
    public DatabaseSettings Database { get; init; } = new();
    public FrigateSettings Frigate { get; init; } = new();
    public NotificationsSettings Notifications { get; init; } = new();

    public sealed class DatabaseSettings
    {
        public string ConnectionString { get; init; } = "Data Source=./data/vyzio.db";
    }

    public sealed class FrigateSettings
    {
        public IReadOnlyList<string> RetainedLabels { get; init; } = Array.Empty<string>();
        public string ApiBaseUrl { get; init; } = "http://frigate:5000";
        public string ConfigPath { get; init; } = string.Empty;
        public string ApplyCommand { get; init; } = string.Empty;
        public string DatabasePath { get; init; } = "/media/frigate/frigate.db";
        public MqttSettings Mqtt { get; init; } = new();
    }

    public sealed class MqttSettings
    {
        public string Host { get; init; } = "mqtt";
        public int Port { get; init; } = 1883;
        public string Topic { get; init; } = "frigate/events";
        public string ClientId { get; init; } = "vyzio-api";
    }

    public sealed class NotificationsSettings
    {
        public float MinimumConfidence { get; init; } = 0.75f;
        public TelegramSettings Telegram { get; init; } = new();
    }

    public sealed class TelegramSettings
    {
        public string BotToken { get; init; } = string.Empty;
        public string ChatId { get; init; } = string.Empty;

        public bool IsEnabled => !string.IsNullOrWhiteSpace(BotToken) && !string.IsNullOrWhiteSpace(ChatId);
    }
}
