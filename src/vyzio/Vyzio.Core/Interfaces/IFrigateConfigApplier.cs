using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

public interface IFrigateConfigApplier
{
    Task<FrigateConfigApplyResult> ApplyAsync(IReadOnlyList<Camera> cameras, CancellationToken ct = default);
}