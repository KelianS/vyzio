using Microsoft.Extensions.Logging;
using Vyzio.Core.Entities;

namespace Vyzio.Infrastructure.Services.CameraDiscovery;

internal sealed class AssistedCameraDiscoveryVendorDocumentationCatalog(string catalogPath, ILogger? logger = null)
{
    public VendorDocumentation? GetByVendorFamily(string? vendorFamily)
    {
        if (string.IsNullOrWhiteSpace(vendorFamily) || string.IsNullOrWhiteSpace(catalogPath) || !Directory.Exists(catalogPath))
        {
            logger?.LogInformation("Vendor documentation skipped for {VendorFamily}: catalog path unavailable or vendor unknown. Path={CatalogPath}", vendorFamily, catalogPath);
            return null;
        }

        var filePath = Path.Combine(catalogPath, $"{vendorFamily}.md");
        if (!File.Exists(filePath))
        {
            logger?.LogInformation("Vendor documentation file not found for {VendorFamily}: {FilePath}", vendorFamily, filePath);
            return null;
        }

        var markdown = File.ReadAllText(filePath);
        logger?.LogInformation("Vendor documentation loaded for {VendorFamily} from {FilePath} ({Length} chars).", vendorFamily, filePath, markdown.Length);
        return string.IsNullOrWhiteSpace(markdown)
            ? null
            : new VendorDocumentation(vendorFamily, markdown);
    }
}