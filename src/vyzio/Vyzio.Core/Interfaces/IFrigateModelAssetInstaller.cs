using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

public interface IFrigateModelAssetInstaller
{
    Task EnsureInstalledAsync(FrigateDetectorKind detectorKind, string configDirectory, CancellationToken ct = default);
}
