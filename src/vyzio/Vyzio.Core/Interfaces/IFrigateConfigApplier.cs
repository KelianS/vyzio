using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

public interface IFrigateConfigApplier
{
    Task WriteConfigAsync(IReadOnlyList<Camera> cameras, CancellationToken ct = default);
    Task<FrigateConfigApplyResult> ApplyAsync(IReadOnlyList<Camera> cameras, CancellationToken ct = default);
}