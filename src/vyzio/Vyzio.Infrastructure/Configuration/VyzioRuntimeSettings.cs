using Vyzio.Core.Entities;

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

        // Hard bounds for the CPU-only detector's FPS auto-adjustment (ADR-34) — enforced via
        // Math.Clamp regardless of configured values, so no configuration can push FPS out of range.
        public int CpuDetectFpsMin { get; init; } = 1;
        public int CpuDetectFpsMax { get; init; } = 5;

        // Rough, unbenchmarked estimate of sustainable detect FPS per CPU core — the total budget
        // (CpuCoreCount * CpuDetectFpsPerCore) is split across active cameras, then clamped.
        public double CpuDetectFpsPerCore { get; init; } = 1.0;

        // Motion sensitivity auto-tuning loop (ADR-35) — defined in Core so the Application layer,
        // which runs the loop and never references Infrastructure, can consume it directly.
        public MotionTuningOptions MotionTuning { get; init; } = new();
    }

    public sealed class MqttSettings
    {
        public string Host { get; init; } = "mqtt";
        public int Port { get; init; } = 1883;
        public string Topic { get; init; } = "frigate/events";
        public string ClientId { get; init; } = "vyzio-api";
    }

    // Discovery is configured by network scope only — which subnets/hosts to scan and how hard.
    // The ports to probe and their protocols are internal constants (DiscoveryPortCatalog, ADR-32),
    // not user configuration: the user shouldn't have to know a camera speaks V380 on 8800.
    public sealed class DiscoverySettings
    {
        public bool AutoDetectLocalCidrs { get; init; }
        public IReadOnlyList<string> ProbeHosts { get; init; } = Array.Empty<string>();
        public IReadOnlyList<string> ProbeCidrs { get; init; } = Array.Empty<string>();
        public int ProbeTimeoutMs { get; init; } = 250;
        public int MaxConcurrentProbes { get; init; } = 32;

        // Test-only seams — never populated from configuration/env (see VyzioConfigLoader), so the
        // user-facing config surface is subnet/hosts only. Each null → the internal port catalog
        // (production). Unit tests pin exactly which ports a probe touches (and set ScanPortsOverride
        // = [] to disable the sweep) so they never hit the real services running on the test host.
        public IReadOnlyList<int>? ScanPortsOverride { get; init; }
        public IReadOnlyList<int>? RtspPortsOverride { get; init; }
        public IReadOnlyList<int>? HttpPortsOverride { get; init; }

        // Which fingerprint to attempt on a port, overriding the catalog's port → protocol mapping.
        // Lets a test exercise a fingerprint on an ephemeral port instead of binding the well-known
        // one, which collides with whatever already listens on the machine.
        public IReadOnlyDictionary<int, SupportedProtocol>? PortFingerprintsOverride { get; init; }

        // ONVIF discovery is a WS-Discovery multicast on the real LAN: it answers with whatever
        // cameras are around and always waits out its 2s window. Tests turn it off to stay hermetic.
        public bool OnvifMulticastEnabled { get; init; } = true;
    }

    public sealed class DocumentationSettings
    {
        public string VendorCatalogPath { get; init; } = string.Empty;
    }
}
