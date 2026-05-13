using Microsoft.Extensions.Logging;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.Configuration;
using Vyzio.Infrastructure.Services.CameraDiscovery;

namespace Vyzio.Infrastructure.Services;

public sealed class AssistedCameraDiscoveryService : ICameraDiscoveryService
{
    private readonly AssistedCameraDiscoveryFormatter _formatter = new();
    private readonly AssistedCameraDiscoveryIdentifier _identifier = new();
    private readonly ILogger<AssistedCameraDiscoveryService>? _logger;
    private readonly AssistedCameraDiscoveryProbePipeline _probePipeline;

    public AssistedCameraDiscoveryService(VyzioRuntimeSettings settings, ILogger<AssistedCameraDiscoveryService>? logger = null)
    {
        _logger = logger;
        _probePipeline = new AssistedCameraDiscoveryProbePipeline(settings, logger);
    }

    public async Task<IReadOnlyList<CameraDiscoveryCandidate>> DiscoverAsync(CancellationToken ct = default)
    {
        var rawSignals = await _probePipeline.DiscoverAsync(ct);
        var identifiedCandidates = _identifier.Identify(rawSignals);
        var result = _formatter.Format(identifiedCandidates);

        _logger?.LogInformation("Assisted camera discovery completed with {CandidateCount} unique candidate(s).", result.Count);
        return result;
    }
}