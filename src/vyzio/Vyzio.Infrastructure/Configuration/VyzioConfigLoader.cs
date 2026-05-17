namespace Vyzio.Infrastructure.Configuration;

public static class VyzioConfigLoader
{
    public static VyzioRuntimeSettings Load()
    {
        static string Env(string name, string @default = "") =>
            Environment.GetEnvironmentVariable(name) is { } v && !string.IsNullOrWhiteSpace(v) ? v.Trim() : @default;

        static int EnvInt(string name, int @default) =>
            int.TryParse(Env(name), out var i) ? i : @default;

        static bool EnvBool(string name) =>
            bool.TryParse(Env(name), out var b) && b;

        static string[] EnvList(string name, string[]? @default = null) =>
            Env(name) is { Length: > 0 } raw
                ? raw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                : @default ?? [];

        static int[] EnvIntList(string name, int[]? @default = null)
        {
            var raw = Env(name);
            if (string.IsNullOrEmpty(raw)) return @default ?? [];
            return raw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                      .Select(s => int.TryParse(s, out var i) ? i : -1)
                      .Where(i => i > 0)
                      .ToArray();
        }

        var probeTimeoutMs = EnvInt("VYZIO_DISCOVERY_PROBE_TIMEOUT_MS", 250);
        var maxConcurrentProbes = EnvInt("VYZIO_DISCOVERY_MAX_CONCURRENT_PROBES", 32);

        return new VyzioRuntimeSettings
        {
            TimeZone = Env("VYZIO_TIME_ZONE"),
            Database = new VyzioRuntimeSettings.DatabaseSettings
            {
                ConnectionString = Env("VYZIO_DATABASE_CONNECTION_STRING", "Data Source=./data/vyzio.db")
            },
            Frigate = new VyzioRuntimeSettings.FrigateSettings
            {
                ApiBaseUrl = Env("VYZIO_FRIGATE_API_BASE_URL", "http://frigate:5000").TrimEnd('/'),
                ConfigPath = Env("VYZIO_FRIGATE_CONFIG_PATH", "/config/config.yml"),
                ApplyCommand = Env("VYZIO_FRIGATE_APPLY_COMMAND", "docker restart vyzio-frigate"),
                DatabasePath = Env("VYZIO_FRIGATE_DATABASE_PATH", "/media/frigate/frigate.db"),
                RetainedLabels = EnvList("VYZIO_FRIGATE_RETAINED_LABELS"),
                Mqtt = new VyzioRuntimeSettings.MqttSettings
                {
                    Host = Env("VYZIO_FRIGATE_MQTT_HOST", "mqtt"),
                    Port = EnvInt("VYZIO_FRIGATE_MQTT_PORT", 1883),
                    Topic = Env("VYZIO_FRIGATE_MQTT_TOPIC", "frigate/events"),
                    ClientId = Env("VYZIO_FRIGATE_MQTT_CLIENT_ID", "vyzio-api")
                }
            },
            Discovery = new VyzioRuntimeSettings.DiscoverySettings
            {
                AutoDetectLocalCidrs = EnvBool("VYZIO_DISCOVERY_AUTO_DETECT_LOCAL_CIDRS"),
                ProbeHosts = EnvList("VYZIO_DISCOVERY_PROBE_HOSTS"),
                ProbeCidrs = EnvList("VYZIO_DISCOVERY_PROBE_CIDRS"),
                RtspPorts = EnvIntList("VYZIO_DISCOVERY_RTSP_PORTS", [554]),
                RtspPaths = EnvList("VYZIO_DISCOVERY_RTSP_PATHS", ["/stream1", "/stream2", "/Streaming/Channels/101", "/live/ch00_1", "/h264Preview_01_main"]),
                HttpPorts = EnvIntList("VYZIO_DISCOVERY_HTTP_PORTS", [80, 443, 8080]),
                OnvifPorts = EnvIntList("VYZIO_DISCOVERY_ONVIF_PORTS", [80, 2020]),
                ProbeTimeoutMs = probeTimeoutMs is < 50 or > 5000 ? 250 : probeTimeoutMs,
                MaxConcurrentProbes = maxConcurrentProbes is < 1 or > 256 ? 32 : maxConcurrentProbes,
            },
            Documentation = new VyzioRuntimeSettings.DocumentationSettings
            {
                VendorCatalogPath = Env("VYZIO_DOCUMENTATION_VENDOR_CATALOG_PATH", "/app/vendors")
            }
        };
    }
}
