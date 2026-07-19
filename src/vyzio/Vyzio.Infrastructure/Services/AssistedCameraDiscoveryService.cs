using Microsoft.Extensions.Logging;
using System.Net;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.Configuration;
using Vyzio.Infrastructure.Services.CameraDiscovery;

namespace Vyzio.Infrastructure.Services;

public sealed class AssistedCameraDiscoveryService : ICameraDiscoveryService
{
    private readonly AssistedCameraDiscoveryFormatter _formatter = new();
    private readonly AssistedCameraDiscoveryIdentifier _identifier;
    private readonly ILogger<AssistedCameraDiscoveryService>? _logger;
    private readonly AssistedCameraDiscoveryProbePipeline _probePipeline;
    private readonly VyzioRuntimeSettings _settings;
    private readonly ICapabilityProviderRegistry? _capabilityRegistry;

    // capabilityRegistry is optional so the discovery tests can construct the service without the
    // full DI graph; in production DI always injects it, and it's the single source for which
    // protocol serves which capability (ADR-32). Null → the Capabilities interpretation is empty.
    public AssistedCameraDiscoveryService(
        VyzioRuntimeSettings settings,
        ICapabilityProviderRegistry? capabilityRegistry = null,
        ILogger<AssistedCameraDiscoveryService>? logger = null)
    {
        _settings = settings;
        _logger = logger;
        _capabilityRegistry = capabilityRegistry;
        _probePipeline = new AssistedCameraDiscoveryProbePipeline(settings, logger);
        _identifier = new AssistedCameraDiscoveryIdentifier(new AssistedCameraDiscoveryVendorDocumentationCatalog(settings.Documentation.VendorCatalogPath, logger));
    }

    public async Task<IReadOnlyList<CameraDiscoveryCandidate>> DiscoverAsync(CameraDiscoveryTarget? target = null, CancellationToken ct = default)
    {
        var rawSignals = await _probePipeline.DiscoverAsync(target, ct);
        var identifiedCandidates = _identifier.Identify(rawSignals);
        var result = await EnrichTechnicalDetailsAsync(_formatter.Format(identifiedCandidates), rawSignals, ct);

        _logger?.LogInformation("Assisted camera discovery completed with {CandidateCount} unique candidate(s).", result.Count);
        return result;
    }

    private async Task<IReadOnlyList<CameraDiscoveryCandidate>> EnrichTechnicalDetailsAsync(
        IReadOnlyList<CameraDiscoveryCandidate> candidates,
        IReadOnlyList<RawCameraDiscoverySignal> rawSignals,
        CancellationToken ct)
    {
        var signalsByHost = rawSignals
            .GroupBy(signal => signal.Host, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(
                group => group.Key,
                group => group.ToList(),
                StringComparer.OrdinalIgnoreCase);

        var resolvedHostNames = await ResolveDisplayedHostNamesAsync(candidates, signalsByHost, ct);

        return candidates
            .Select(candidate => candidate with
            {
                TechnicalDetails = new DiscoveryTechnicalDetails(
                    resolvedHostNames.GetValueOrDefault(candidate.Host),
                    GetDetectedPorts(signalsByHost, candidate.Host),
                    GetDetectedRtspPaths(signalsByHost, candidate.Host),
                    GetDetectedCapabilities(signalsByHost, candidate.Host))
            })
            .ToList();
    }

    private static async Task<Dictionary<string, string?>> ResolveDisplayedHostNamesAsync(
        IReadOnlyList<CameraDiscoveryCandidate> candidates,
        IReadOnlyDictionary<string, List<RawCameraDiscoverySignal>> signalsByHost,
        CancellationToken ct)
    {
        var results = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);

        foreach (var candidate in candidates)
        {
            var resolvedFromSignals = GetResolvedHostName(signalsByHost, candidate.Host);
            if (!string.IsNullOrWhiteSpace(resolvedFromSignals))
            {
                results[candidate.Host] = resolvedFromSignals;
                continue;
            }

            results[candidate.Host] = await ResolveHostNameForDisplayAsync(candidate.Host, ct);
        }

        return results;
    }

    private static string? GetResolvedHostName(
        IReadOnlyDictionary<string, List<RawCameraDiscoverySignal>> signalsByHost,
        string host)
        => signalsByHost.TryGetValue(host, out var signals)
            ? signals.Select(signal => signal.ResolvedHostName)
                .FirstOrDefault(hostName => !string.IsNullOrWhiteSpace(hostName))
            : null;

    private static async Task<string?> ResolveHostNameForDisplayAsync(string host, CancellationToken ct)
    {
        if (!IPAddress.TryParse(host, out _))
        {
            return null;
        }

        try
        {
            var entry = await Dns.GetHostEntryAsync(host, ct);
            return string.IsNullOrWhiteSpace(entry.HostName)
                ? null
                : entry.HostName.TrimEnd('.');
        }
        catch
        {
            return null;
        }
    }

    // The detected-ports table is sourced only from the port sweep ("port_scan" signals). Each
    // carries either a fingerprint-confirmed protocol or, for an open-but-unidentified port, a
    // conventional service label (ADR-32) — the frontend just renders Label.
    private static IReadOnlyList<DetectedPortSignal> GetDetectedPorts(
        IReadOnlyDictionary<string, List<RawCameraDiscoverySignal>> signalsByHost,
        string host)
    {
        if (!signalsByHost.TryGetValue(host, out var signals))
        {
            return [];
        }

        return signals
            .Where(signal => signal.DiscoverySource == "port_scan" && signal.Port > 0)
            .Select(signal => new DetectedPortSignal(
                signal.ConfirmedProtocol?.ToString() ?? "unknown",
                signal.ConfirmedProtocol is { } p
                    ? DiscoveryPortCatalog.FormatProtocolLabel(p)
                    : string.IsNullOrEmpty(signal.PortServiceLabel) ? "non identifié" : signal.PortServiceLabel,
                signal.Port))
            .Distinct()
            .OrderBy(entry => entry.Port)
            .ToList();
    }

    // ADR-32: which capabilities the host supports, crossing the protocols actually detected on it
    // with ICapabilityProviderRegistry.GetRegisteredProtocols(capability). Naturally many-to-many
    // — Stream is a first-class capability here (RTSP/DVRIP providers), so it needs no special case.
    private IReadOnlyList<DetectedCapability> GetDetectedCapabilities(
        IReadOnlyDictionary<string, List<RawCameraDiscoverySignal>> signalsByHost,
        string host)
    {
        if (_capabilityRegistry is null || !signalsByHost.TryGetValue(host, out var signals))
        {
            return [];
        }

        // Protocols proven on this host: fingerprint-confirmed on an open port (ConfirmedProtocol),
        // or identified by a handshake source (ONVIF multicast, via the protocol catalog).
        var detectedProtocols = new HashSet<SupportedProtocol>();
        foreach (var signal in signals)
        {
            if (signal.ConfirmedProtocol is { } confirmed)
            {
                detectedProtocols.Add(confirmed);
            }
            if (DiscoveryProtocolCatalog.Lookup(signal.DiscoverySource)?.CapabilityProtocol is { } p)
            {
                detectedProtocols.Add(p);
            }
        }

        if (detectedProtocols.Count == 0)
        {
            return [];
        }

        var result = new List<DetectedCapability>();
        foreach (var capability in Enum.GetValues<CameraCapability>())
        {
            var available = _capabilityRegistry.GetRegisteredProtocols(capability)
                .Where(detectedProtocols.Contains)
                .ToList();
            if (available.Count > 0)
            {
                result.Add(new DetectedCapability(
                    capability.ToString(),
                    FormatCapabilityLabel(capability),
                    available.Select(DiscoveryPortCatalog.FormatProtocolLabel).ToList()));
            }
        }

        return result;
    }

    private static string FormatCapabilityLabel(CameraCapability capability) => capability switch
    {
        CameraCapability.Stream => "Flux vidéo",
        CameraCapability.Ptz => "PTZ",
        CameraCapability.HardwarePrivacy => "Confidentialité matérielle",
        CameraCapability.ImageSettings => "Réglages image",
        _ => capability.ToString(),
    };

    private static IReadOnlyList<string> GetDetectedRtspPaths(
        IReadOnlyDictionary<string, List<RawCameraDiscoverySignal>> signalsByHost,
        string host)
        => !signalsByHost.TryGetValue(host, out var signals)
            ? []
            : signals
                .Select(signal => signal.StreamPath)
                .Where(path => !string.IsNullOrWhiteSpace(path))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Order(StringComparer.OrdinalIgnoreCase)
                .ToArray()!;
}