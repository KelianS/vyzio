using Microsoft.Extensions.Logging;
using System.Text.RegularExpressions;
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

    public AssistedCameraDiscoveryService(VyzioRuntimeSettings settings, ILogger<AssistedCameraDiscoveryService>? logger = null)
    {
        _settings = settings;
        _logger = logger;
        _probePipeline = new AssistedCameraDiscoveryProbePipeline(settings, logger);
        _identifier = new AssistedCameraDiscoveryIdentifier(new AssistedCameraDiscoveryVendorDocumentationCatalog(settings.Documentation.VendorCatalogPath, logger));
    }

    public async Task<IReadOnlyList<CameraDiscoveryCandidate>> DiscoverAsync(CancellationToken ct = default)
    {
        var rawSignals = await _probePipeline.DiscoverAsync(ct);
        var identifiedCandidates = _identifier.Identify(rawSignals);
        var result = EnrichTechnicalDetails(_formatter.Format(identifiedCandidates), rawSignals);

        _logger?.LogInformation("Assisted camera discovery completed with {CandidateCount} unique candidate(s).", result.Count);
        return result;
    }

    private IReadOnlyList<CameraDiscoveryCandidate> EnrichTechnicalDetails(
        IReadOnlyList<CameraDiscoveryCandidate> candidates,
        IReadOnlyList<RawCameraDiscoverySignal> rawSignals)
    {
        var signalsByHost = rawSignals
            .GroupBy(signal => signal.Host, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(
                group => group.Key,
                group => group.ToList(),
                StringComparer.OrdinalIgnoreCase);

        return candidates
            .Select(candidate => candidate with
            {
                TechnicalDetails = new DiscoveryTechnicalDetails(
                    GetResolvedHostName(signalsByHost, candidate.Host),
                    GetDetectedPorts(signalsByHost, candidate.Host, IsHttpSignal),
                    GetDetectedPorts(signalsByHost, candidate.Host, IsRtspSignal),
                    GetDetectedOnvifPorts(signalsByHost, candidate.Host),
                    GetDetectedRtspPaths(signalsByHost, candidate.Host))
            })
            .ToList();
    }

    private static string? GetResolvedHostName(
        IReadOnlyDictionary<string, List<RawCameraDiscoverySignal>> signalsByHost,
        string host)
        => signalsByHost.TryGetValue(host, out var signals)
            ? signals.Select(signal => signal.ResolvedHostName)
                .FirstOrDefault(hostName => !string.IsNullOrWhiteSpace(hostName))
            : null;

    private static IReadOnlyList<int> GetDetectedPorts(
        IReadOnlyDictionary<string, List<RawCameraDiscoverySignal>> signalsByHost,
        string host,
        Func<RawCameraDiscoverySignal, bool> predicate)
        => !signalsByHost.TryGetValue(host, out var signals)
            ? []
            : signals
                .Where(predicate)
                .Select(signal => signal.Port)
                .Where(port => port > 0)
                .Distinct()
                .Order()
                .ToArray();

    private static IReadOnlyList<int> GetDetectedOnvifPorts(
        IReadOnlyDictionary<string, List<RawCameraDiscoverySignal>> signalsByHost,
        string host)
    {
        if (!signalsByHost.TryGetValue(host, out var signals))
        {
            return [];
        }

        return signals
            .Where(IsOnvifSignal)
            .Select(GetOnvifPort)
            .Where(port => port > 0)
            .Distinct()
            .Order()
            .ToArray();
    }

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

    private static bool IsHttpSignal(RawCameraDiscoverySignal signal)
        => signal.DiscoverySource is "http_probe" or "http_service";

    private static bool IsRtspSignal(RawCameraDiscoverySignal signal)
        => signal.DiscoverySource is "rtsp_describe" or "network_scan";

    private static bool IsOnvifSignal(RawCameraDiscoverySignal signal)
        => signal.DiscoverySource is "onvif" or "onvif_unicast";

    private static int GetOnvifPort(RawCameraDiscoverySignal signal)
    {
        if (signal.DiscoverySource == "onvif_unicast")
        {
            return signal.Port;
        }

        if (string.IsNullOrWhiteSpace(signal.Note))
        {
            return 0;
        }

        var match = Regex.Match(signal.Note, $@"{Regex.Escape(signal.Host)}:(\d+)", RegexOptions.IgnoreCase);
        return match.Success && int.TryParse(match.Groups[1].Value, out var port)
            ? port
            : 0;
    }
}