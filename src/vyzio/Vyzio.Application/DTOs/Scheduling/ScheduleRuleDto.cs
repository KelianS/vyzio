using Vyzio.Core.Common;
using Vyzio.Core.Entities;

namespace Vyzio.Application.DTOs.Scheduling;

public sealed record ScheduleRuleDto(
    string Id,
    string Kind,
    IReadOnlyList<string> TargetIds,
    IReadOnlyList<int> DaysOfWeek,
    string StartTime,
    string EndTime,
    DateTimeOffset CreatedAt)
{
    public static ScheduleRuleDto From(ScheduleRule rule) => new(
        rule.Id,
        SnakeCaseEnum.ToSnakeCase(rule.Kind),
        rule.GetTargetIds(),
        rule.GetDaysOfWeek(),
        rule.StartTime,
        rule.EndTime,
        rule.CreatedAt);
}

/// <param name="Kind">The rule's type in snake_case; fixed once the rule exists.</param>
public sealed record CreateScheduleRuleRequest(
    string Kind,
    IReadOnlyList<string> TargetIds,
    IReadOnlyList<int> DaysOfWeek,
    string StartTime,
    string EndTime);

public sealed record UpdateScheduleRuleRequest(
    IReadOnlyList<string> TargetIds,
    IReadOnlyList<int> DaysOfWeek,
    string StartTime,
    string EndTime);
