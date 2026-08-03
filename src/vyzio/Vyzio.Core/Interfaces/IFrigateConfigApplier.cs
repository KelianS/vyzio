using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

public interface IFrigateConfigApplier
{
    // Scopes come from the caller: once the config is generated every change looks alike. A list
    // because one request can carry two (a camera saves detection settings and retention overrides).
    Task WriteConfigAsync(IReadOnlyList<Camera> cameras, IReadOnlyList<SurveillanceChangeScope> scopes, CancellationToken ct = default);
    Task<FrigateConfigApplyResult> ApplyAsync(IReadOnlyList<Camera> cameras, CancellationToken ct = default);

    // Written but not taken up yet. Named, not counted: the user decides when to restart (ADR-44).
    IReadOnlyList<SurveillanceChangeScope> PendingChanges { get; }
}
