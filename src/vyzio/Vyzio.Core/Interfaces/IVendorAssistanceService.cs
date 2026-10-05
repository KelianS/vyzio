using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

public interface IVendorAssistanceService
{
    Task<VendorDocumentation?> GetAssistanceAsync(string? vendorFamily, CancellationToken ct = default);
}
