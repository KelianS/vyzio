using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.VendorAdapters;

public sealed class VendorCameraAdapterFactory(IEnumerable<IVendorCameraAdapter> adapters) : IVendorCameraAdapterFactory
{
    private readonly IReadOnlyDictionary<string, IVendorCameraAdapter> _map =
        adapters.ToDictionary(a => a.VendorFamily, StringComparer.OrdinalIgnoreCase);

    private readonly NullVendorCameraAdapter _null = new();

    // Vendor families that route to the generic ONVIF adapter (capability-detected step control).
    // Camera entities keep their original vendorFamily in the database — alias is runtime-only.
    private static readonly Dictionary<string, string> _familyAliases = new(StringComparer.OrdinalIgnoreCase)
    {
        ["v380_pro"] = "onvif",
    };

    public IVendorCameraAdapter Resolve(Camera camera)
    {
        if (string.IsNullOrWhiteSpace(camera.VendorFamily))
            return _null;

        var family = _familyAliases.TryGetValue(camera.VendorFamily, out var alias) ? alias : camera.VendorFamily;
        return _map.TryGetValue(family, out var adapter) ? adapter : _null;
    }
}
