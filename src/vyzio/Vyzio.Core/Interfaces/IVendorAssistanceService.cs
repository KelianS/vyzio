using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

public interface IVendorAssistanceService
{
    Task<VendorDocumentation?> GetAssistanceAsync(string? vendorFamily, string? streamPath, bool connected, CancellationToken ct = default);
}