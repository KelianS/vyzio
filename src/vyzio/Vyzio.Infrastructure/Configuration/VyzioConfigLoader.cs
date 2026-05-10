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
                RetainedLabels = root.Frigate.RetainedLabels
                    .Where(label => !string.IsNullOrWhiteSpace(label))
                    .Select(label => label.Trim())
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToArray()
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
        public IReadOnlyList<string> RetainedLabels { get; init; } = Array.Empty<string>();
    }
}
