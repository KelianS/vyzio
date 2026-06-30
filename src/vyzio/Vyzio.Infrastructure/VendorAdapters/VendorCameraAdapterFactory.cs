using Vyzio.Core.Common;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.VendorAdapters;

// Bridges Camera.VendorFamily (typed enum, ADR-22) to the legacy string-keyed
// IVendorCameraAdapter.VendorFamily property. This factory and IVendorCameraAdapter are
// slated for removal once the capability provider migration (ADR-22 phase 3) lands.
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
        if (camera.VendorFamily is not { } vendorFamily)
            return _null;

        var key = SnakeCaseEnum.ToSnakeCase(vendorFamily);
        var family = _familyAliases.TryGetValue(key, out var alias) ? alias : key;
        return _map.TryGetValue(family, out var adapter) ? adapter : _null;
    }
}
