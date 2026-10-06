using System.Globalization;
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
/// <param name="TargetIds">Null when the body omits it, refused as no target.</param>
/// <param name="DaysOfWeek">Null when the body omits it, refused as no day.</param>
public sealed record CreateScheduleRuleRequest(
    string Kind,
    IReadOnlyList<string>? TargetIds,
    IReadOnlyList<int>? DaysOfWeek,
    string StartTime,
    string EndTime);

public sealed record UpdateScheduleRuleRequest(
    IReadOnlyList<string>? TargetIds,
    IReadOnlyList<int>? DaysOfWeek,
    string StartTime,
    string EndTime);

/// <param name="DayOfWeek">0 = Sunday, as a rule's days.</param>
/// <param name="Time">"HH:mm" in the house's clock.</param>
public sealed record HouseClockDto(int DayOfWeek, string Time)
{
    public static HouseClockDto Of(DateTimeOffset houseMoment) =>
        new((int)houseMoment.DayOfWeek, houseMoment.ToString("HH:mm", CultureInfo.InvariantCulture));
}
