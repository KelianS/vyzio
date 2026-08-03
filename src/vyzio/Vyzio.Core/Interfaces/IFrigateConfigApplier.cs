using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

public interface IFrigateConfigApplier
{
    // `changed` comes from the caller: once the config is generated, a write that changes something
    // looks exactly like one that does not, and only a real change may summon the restart prompt.
    Task WriteConfigAsync(IReadOnlyList<Camera> cameras, bool changed, CancellationToken ct = default);
    Task<FrigateConfigApplyResult> ApplyAsync(IReadOnlyList<Camera> cameras, CancellationToken ct = default);

    // Written but not taken up yet: the user decides when to restart (ADR-44).
    bool HasPendingChanges { get; }
}
