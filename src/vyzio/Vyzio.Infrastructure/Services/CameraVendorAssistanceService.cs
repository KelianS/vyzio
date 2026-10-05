using Microsoft.Extensions.Logging;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.Configuration;
using Vyzio.Infrastructure.Services.CameraDiscovery;

namespace Vyzio.Infrastructure.Services;

public sealed class CameraVendorAssistanceService : IVendorAssistanceService
{
    private readonly AssistedCameraDiscoveryVendorDocumentationCatalog _catalog;
    private readonly ILogger<CameraVendorAssistanceService> _logger;

    public CameraVendorAssistanceService(VyzioRuntimeSettings settings, ILogger<CameraVendorAssistanceService> logger)
    {
        _logger = logger;
        _catalog = new AssistedCameraDiscoveryVendorDocumentationCatalog(settings.Documentation.VendorCatalogPath, logger);
    }

    public Task<VendorDocumentation?> GetAssistanceAsync(string? vendorFamily, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(vendorFamily))
        {
            _logger.LogInformation("Vendor assistance skipped: vendor is unknown.");
            return Task.FromResult<VendorDocumentation?>(null);
        }

        return Task.FromResult(_catalog.GetByVendorFamily(vendorFamily));
    }
}
