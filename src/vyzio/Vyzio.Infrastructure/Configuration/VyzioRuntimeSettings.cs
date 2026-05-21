namespace Vyzio.Infrastructure.Configuration;

public class VyzioRuntimeSettings
{
    public string? TimeZone { get; init; }
    public DatabaseSettings Database { get; init; } = new();
    public FrigateSettings Frigate { get; init; } = new();
    public DiscoverySettings Discovery { get; init; } = new();
    public DocumentationSettings Documentation { get; init; } = new();

    public sealed class DatabaseSettings
    {
        public string ConnectionString { get; init; } = "Data Source=./data/vyzio.db";
    }

    public sealed class FrigateSettings
    {
        public IReadOnlyList<string> RetainedLabels { get; init; } = Array.Empty<string>();
        public string ApiBaseUrl { get; init; } = "http://frigate:5000";
        public string ConfigPath { get; init; } = "/config/config.yml";
        public string ApplyCommand { get; init; } = "docker restart vyzio-frigate";
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

    public sealed class DiscoverySettings
    {
        public bool AutoDetectLocalCidrs { get; init; }
        public IReadOnlyList<string> ProbeHosts { get; init; } = Array.Empty<string>();
        public IReadOnlyList<string> ProbeCidrs { get; init; } = Array.Empty<string>();
        public IReadOnlyList<int> RtspPorts { get; init; } = [554];
        public IReadOnlyList<string> RtspPaths { get; init; } =
        [
            "/stream1", "/stream2",
            "/Streaming/Channels/101",
            "/live/ch00_1",
            "/h264Preview_01_main",
            // ICSee / XMEye
            "/user=admin&password=&channel=1&stream=0.sdp",
            "/user=admin&password=&channel=1&stream=1.sdp",
            "/cam/realmonitor?channel=1&subtype=0",
        ];
        public IReadOnlyList<int> HttpPorts { get; init; } = [80, 443, 8080];
        public IReadOnlyList<int> OnvifPorts { get; init; } = [80, 2020];
        public int ProbeTimeoutMs { get; init; } = 250;
        public int MaxConcurrentProbes { get; init; } = 32;
    }

    public sealed class DocumentationSettings
    {
        public string VendorCatalogPath { get; init; } = string.Empty;
    }
}
