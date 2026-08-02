using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

public interface IFrigateConfigApplier
{
    Task WriteConfigAsync(IReadOnlyList<Camera> cameras, CancellationToken ct = default);
    Task<FrigateConfigApplyResult> ApplyAsync(IReadOnlyList<Camera> cameras, CancellationToken ct = default);

    // True when a written configuration has not been applied yet. Most settings only take effect on
    // the next restart of the detection engine, and leaving the user to guess that was a real gap:
    // they changed a setting, nothing happened, and nothing said why.
    bool HasPendingChanges { get; }
}