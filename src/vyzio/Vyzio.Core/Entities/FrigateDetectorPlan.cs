namespace Vyzio.Core.Entities;

// Result of IFrigateDetectorPlanner.Plan (ADR-34) — shared by FrigateConfigApplier (writes it into
// frigate.yml) and GetSystemStatsUseCase (reports it to the Hub), so the two never compute it
// independently and drift apart.
public sealed record FrigateDetectorPlan(FrigateDetectorKind Kind, int Fps, FrigateHwAccel HwAccel);
