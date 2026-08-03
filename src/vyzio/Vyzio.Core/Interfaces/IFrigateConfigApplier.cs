using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

public interface IFrigateConfigApplier
{
    // The scopes are passed in because only the caller knows what the user just changed: once the
    // configuration is generated, every change looks alike. A list rather than one value because a
    // single request can legitimately carry two — a camera's page saves its detection settings and
    // its retention overrides together.
    Task WriteConfigAsync(IReadOnlyList<Camera> cameras, IReadOnlyList<SurveillanceChangeScope> scopes, CancellationToken ct = default);
    Task<FrigateConfigApplyResult> ApplyAsync(IReadOnlyList<Camera> cameras, CancellationToken ct = default);

    // What has been written but not taken up yet. Restarting is the user's own decision (ADR-44),
    // so this has to name what is waiting rather than merely admit that something is — a bare
    // boolean cannot become a sentence anyone would act on.
    IReadOnlyList<SurveillanceChangeScope> PendingChanges { get; }
}
