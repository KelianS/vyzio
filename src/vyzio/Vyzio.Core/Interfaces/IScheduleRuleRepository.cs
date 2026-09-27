using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

public interface IScheduleRuleRepository
{
    Task<IReadOnlyList<ScheduleRule>> GetAllAsync(CancellationToken ct = default);
    Task<IReadOnlyList<ScheduleRule>> GetByKindAsync(ScheduleRuleKind kind, CancellationToken ct = default);
    Task<ScheduleRule?> GetByIdAsync(string id, CancellationToken ct = default);
    Task AddAsync(ScheduleRule rule, CancellationToken ct = default);
    Task UpdateAsync(ScheduleRule rule, CancellationToken ct = default);
    Task DeleteAsync(ScheduleRule rule, CancellationToken ct = default);
}
