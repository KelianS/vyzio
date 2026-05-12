using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;

namespace Vyzio.Infrastructure.Configuration;

public static class VyzioConfigLoader
{
    public static VyzioRuntimeSettings Load(string configPath)
    {
        if (!File.Exists(configPath))
        {
            throw new FileNotFoundException("Vyzio config file not found.", configPath);
        }

        var yaml = File.ReadAllText(configPath);
        var deserializer = new DeserializerBuilder()
            .WithNamingConvention(UnderscoredNamingConvention.Instance)
            .IgnoreUnmatchedProperties()
            .Build();

        var root = deserializer.Deserialize<RootConfig>(yaml) ?? new RootConfig();

        var configDirectory = Path.GetDirectoryName(configPath) ?? Directory.GetCurrentDirectory();

        return new VyzioRuntimeSettings
        {
            Database = new VyzioRuntimeSettings.DatabaseSettings
            {
                ConnectionString = string.IsNullOrWhiteSpace(root.Database.ConnectionString)
                    ? "Data Source=./data/vyzio.db"
                    : root.Database.ConnectionString
            },
            Frigate = new VyzioRuntimeSettings.FrigateSettings
            {
                ApiBaseUrl = string.IsNullOrWhiteSpace(root.Frigate.ApiBaseUrl)
                    ? "http://frigate:5000"
                    : root.Frigate.ApiBaseUrl.TrimEnd('/'),
                ConfigPath = ResolvePath(root.Frigate.ConfigPath, configDirectory, "frigate.generated.yml"),
                ApplyCommand = root.Frigate.ApplyCommand?.Trim() ?? string.Empty,
                DatabasePath = string.IsNullOrWhiteSpace(root.Frigate.DatabasePath)
                    ? "/media/frigate/frigate.db"
                    : root.Frigate.DatabasePath.Trim(),
                RetainedLabels = root.Frigate.RetainedLabels
                    .Where(label => !string.IsNullOrWhiteSpace(label))
                    .Select(label => label.Trim())
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToArray(),
                Mqtt = new VyzioRuntimeSettings.MqttSettings
                {
                    Host = string.IsNullOrWhiteSpace(root.Frigate.Mqtt.Host) ? "mqtt" : root.Frigate.Mqtt.Host,
                    Port = root.Frigate.Mqtt.Port <= 0 ? 1883 : root.Frigate.Mqtt.Port,
                    Topic = string.IsNullOrWhiteSpace(root.Frigate.Mqtt.Topic) ? "frigate/events" : root.Frigate.Mqtt.Topic,
                    ClientId = string.IsNullOrWhiteSpace(root.Frigate.Mqtt.ClientId) ? "vyzio-api" : root.Frigate.Mqtt.ClientId
                }
            },
            Notifications = new VyzioRuntimeSettings.NotificationsSettings
            {
                MinimumConfidence = root.Notifications.MinimumConfidence is < 0 or > 1
                    ? 0.75f
                    : root.Notifications.MinimumConfidence,
                Telegram = new VyzioRuntimeSettings.TelegramSettings
                {
                    BotToken = root.Notifications.Telegram.BotToken?.Trim() ?? string.Empty,
                    ChatId = root.Notifications.Telegram.ChatId?.Trim() ?? string.Empty
                }
            }
        };
    }

    private sealed class RootConfig
    {
        public DatabaseConfig Database { get; init; } = new();
        public FrigateConfig Frigate { get; init; } = new();
        public NotificationsConfig Notifications { get; init; } = new();
    }

    private sealed class DatabaseConfig
    {
        public string ConnectionString { get; init; } = string.Empty;
    }

    private sealed class FrigateConfig
    {
        public string ApiBaseUrl { get; init; } = string.Empty;
        public string ConfigPath { get; init; } = string.Empty;
        public string ApplyCommand { get; init; } = string.Empty;
        public string DatabasePath { get; init; } = string.Empty;
        public List<string> RetainedLabels { get; init; } = [];
        public MqttConfig Mqtt { get; init; } = new();
    }

    private sealed class MqttConfig
    {
        public string Host { get; init; } = string.Empty;
        public int Port { get; init; }
        public string Topic { get; init; } = string.Empty;
        public string ClientId { get; init; } = string.Empty;
    }

    private sealed class NotificationsConfig
    {
        public float MinimumConfidence { get; init; } = 0.75f;
        public TelegramConfig Telegram { get; init; } = new();
    }

    private sealed class TelegramConfig
    {
        public string BotToken { get; init; } = string.Empty;
        public string ChatId { get; init; } = string.Empty;
    }

    private static string ResolvePath(string configuredPath, string configDirectory, string defaultFileName)
    {
        var path = string.IsNullOrWhiteSpace(configuredPath)
            ? defaultFileName
            : configuredPath.Trim();

        return Path.IsPathRooted(path)
            ? path
            : Path.GetFullPath(Path.Combine(configDirectory, path));
    }
}
