using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.VendorAdapters;

public sealed class VendorCameraAdapterFactory(IEnumerable<IVendorCameraAdapter> adapters) : IVendorCameraAdapterFactory
{
    private readonly IReadOnlyDictionary<string, IVendorCameraAdapter> _map =
        adapters.ToDictionary(a => a.VendorFamily, StringComparer.OrdinalIgnoreCase);

    private readonly NullVendorCameraAdapter _null = new();

    public IVendorCameraAdapter Resolve(Camera camera)
    {
        if (string.IsNullOrWhiteSpace(camera.VendorFamily))
            return _null;

        return _map.TryGetValue(camera.VendorFamily, out var adapter) ? adapter : _null;
    }
}
