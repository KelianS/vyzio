using Vyzio.Application.DTOs.Notifications;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Scheduling;

/// <summary>When the ranges of a type next start or stop taking effect, read in the house's clock (SCHED-03).</summary>
public static class ScheduleChanges
{
    /// <summary>The first moment after now at which the set of covering rules differs, or null when no rule can ever cover.</summary>
    public static DateTimeOffset? Next(IReadOnlyList<ScheduleRule> rules, DateTimeOffset now, TimeZoneInfo timeZone)
    {
        var today = TimeZoneInfo.ConvertTime(now, timeZone).Date;

        // A range lasts under a day and begins on one of its days: yesterday's night to next week's same day holds every change.
        return Enumerable.Range(-1, 9)
            .SelectMany(offset => rules.SelectMany(rule => BoundariesOn(rule, today.AddDays(offset))))
            .Select(local => new DateTimeOffset(local, timeZone.GetUtcOffset(local)))
            .Where(moment => moment > now)
            .Distinct()
            .Order()
            .Select(moment => (DateTimeOffset?)moment)
            .FirstOrDefault(moment => !CoveringAt(rules, moment!.Value, timeZone)
                .SetEquals(CoveringAt(rules, moment.Value.AddTicks(-1), timeZone)));
    }

    private static IEnumerable<DateTime> BoundariesOn(ScheduleRule rule, DateTime day)
    {
        if (rule.Start is not { } start || rule.End is not { } end || start == end) yield break;
        if (!rule.GetDaysOfWeek().Contains((int)day.DayOfWeek)) yield break;

        yield return day + start;
        // Before its start, the range ends the next day (SCHED-05).
        yield return end > start ? day + end : day.AddDays(1) + end;
    }

    private static HashSet<string> CoveringAt(IReadOnlyList<ScheduleRule> rules, DateTimeOffset moment, TimeZoneInfo timeZone)
    {
        var local = TimeZoneInfo.ConvertTime(moment, timeZone);
        return [.. rules.Where(rule => rule.Covers(local)).Select(rule => rule.Id)];
    }
}

/// <summary>The next change of one rule type as the house reads it: the first end a Silence or a cut of every camera offers (ADR-15).</summary>
public sealed class ScheduleNextChange(IScheduleRuleRepository rules, TimeZoneInfo timeZone)
{
    public async Task<HouseMomentDto?> OfAsync(ScheduleRuleKind kind, DateTimeOffset now, CancellationToken ct = default)
        => ScheduleChanges.Next(await rules.GetByKindAsync(kind, ct), now, timeZone) is { } change
            ? HouseMomentDto.Of(change, timeZone)
            : null;
}
