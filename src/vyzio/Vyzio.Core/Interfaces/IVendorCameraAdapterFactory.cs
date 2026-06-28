using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

public interface IVendorCameraAdapterFactory
{
    IVendorCameraAdapter Resolve(Camera camera);
}
