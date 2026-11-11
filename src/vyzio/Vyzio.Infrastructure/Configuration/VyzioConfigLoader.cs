using System.Globalization;
using Microsoft.Data.Sqlite;

namespace Vyzio.Infrastructure.Configuration;

/// <summary>The settings read, and one sentence per value Vyzio cannot honour; startup goes on only without any.</summary>
public sealed record VyzioConfigLoad(VyzioRuntimeSettings Settings, IReadOnlyList<string> Problems);

public static class VyzioConfigLoader
{
    public static VyzioConfigLoad Load(Func<string, string?> read)
    {
        ArgumentNullException.ThrowIfNull(read);
        var problems = new List<string>();

        string Env(string name, string @default = "") =>
            read(name) is { } v && !string.IsNullOrWhiteSpace(v) ? v.Trim() : @default;

        int EnvInt(string name, int @default, int min, int max)
        {
            var raw = Env(name);
            if (raw.Length == 0) return @default;
            if (int.TryParse(raw, NumberStyles.None, CultureInfo.InvariantCulture, out var value) && value >= min && value <= max)
                return value;

            problems.Add($"{name} must be a whole number from {min} to {max}.");
            return @default;
        }

        string[] EnvList(string name) =>
            Env(name) is { Length: > 0 } raw
                ? raw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                : [];

        TimeZoneInfo EnvTimeZone(string name)
        {
            var raw = Env(name);
            if (raw.Length == 0) return TimeZoneInfo.Local;
            if (TimeZoneInfo.TryFindSystemTimeZoneById(raw, out var zone)) return zone;

            problems.Add($"{name} must be a time zone name such as Europe/Paris.");
            return TimeZoneInfo.Local;
        }

        string EnvHttpAddress(string name, string @default)
        {
            var raw = Env(name, @default).TrimEnd('/');
            if (Uri.TryCreate(raw, UriKind.Absolute, out var uri)
                && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps))
            {
                return raw;
            }

            problems.Add($"{name} must be an http address such as {@default}.");
            return @default;
        }

        // The value is never echoed: a connection string may carry a password.
        (string ConnectionString, string DataDirectory) EnvDatabase(string name, string @default)
        {
            var raw = Env(name, @default);
            try
            {
                var dataSource = new SqliteConnectionStringBuilder(raw).DataSource;
                if (!string.IsNullOrWhiteSpace(dataSource))
                    return (raw, Path.GetDirectoryName(Path.GetFullPath(dataSource)) ?? Path.GetFullPath("."));
            }
            catch (Exception ex) when (ex is ArgumentException or FormatException)
            {
                // Reported below as a problem, the answer this check exists to give.
            }

            problems.Add($"{name} must be a SQLite connection string such as {@default}.");
            return (@default, string.Empty);
        }

        var database = EnvDatabase("VYZIO_DATABASE_CONNECTION_STRING", "Data Source=./data/vyzio.db");

        var settings = new VyzioRuntimeSettings
        {
            TimeZone = EnvTimeZone("VYZIO_TIME_ZONE"),
            Database = new VyzioRuntimeSettings.DatabaseSettings
            {
                ConnectionString = database.ConnectionString,
                DataDirectory = database.DataDirectory
            },
            Frigate = new VyzioRuntimeSettings.FrigateSettings
            {
                ApiBaseUrl = EnvHttpAddress("VYZIO_FRIGATE_API_BASE_URL", "http://frigate:5000"),
                ConfigPath = Env("VYZIO_FRIGATE_CONFIG_PATH", "/config/config.yml"),
                ApplyCommand = Env("VYZIO_FRIGATE_APPLY_COMMAND", "docker restart vyzio-frigate"),
                DatabasePath = Env("VYZIO_FRIGATE_DATABASE_PATH", "/media/frigate/frigate.db"),
                RetainedLabels = EnvList("VYZIO_FRIGATE_RETAINED_LABELS"),
                Mqtt = new VyzioRuntimeSettings.MqttSettings
                {
                    Host = Env("VYZIO_FRIGATE_MQTT_HOST", "mqtt"),
                    Port = EnvInt("VYZIO_FRIGATE_MQTT_PORT", 1883, 1, 65535),
                    Topic = Env("VYZIO_FRIGATE_MQTT_TOPIC", "frigate/events"),
                    ClientId = Env("VYZIO_FRIGATE_MQTT_CLIENT_ID", "vyzio-api")
                }
            },
            Discovery = new VyzioRuntimeSettings.DiscoverySettings
            {
                ProbeHosts = EnvList("VYZIO_DISCOVERY_PROBE_HOSTS"),
                ProbeCidrs = EnvList("VYZIO_DISCOVERY_PROBE_CIDRS"),
                ProbeTimeoutMs = EnvInt("VYZIO_DISCOVERY_PROBE_TIMEOUT_MS", 250, 50, 5000),
                MaxConcurrentProbes = EnvInt("VYZIO_DISCOVERY_MAX_CONCURRENT_PROBES", 32, 1, 256),
            },
            Documentation = new VyzioRuntimeSettings.DocumentationSettings
            {
                VendorCatalogPath = Env("VYZIO_DOCUMENTATION_VENDOR_CATALOG_PATH", "/app/vendors")
            }
        };

        return new VyzioConfigLoad(settings, problems);
    }
}
