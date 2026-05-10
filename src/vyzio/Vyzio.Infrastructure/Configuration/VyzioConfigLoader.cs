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
            }
        };
    }

    private sealed class RootConfig
    {
        public DatabaseConfig Database { get; init; } = new();
        public FrigateConfig Frigate { get; init; } = new();
    }

    private sealed class DatabaseConfig
    {
        public string ConnectionString { get; init; } = string.Empty;
    }

    private sealed class FrigateConfig
    {
        public string ApiBaseUrl { get; init; } = string.Empty;
        public IReadOnlyList<string> RetainedLabels { get; init; } = Array.Empty<string>();
        public MqttConfig Mqtt { get; init; } = new();
    }

    private sealed class MqttConfig
    {
        public string Host { get; init; } = string.Empty;
        public int Port { get; init; }
        public string Topic { get; init; } = string.Empty;
        public string ClientId { get; init; } = string.Empty;
    }
}
