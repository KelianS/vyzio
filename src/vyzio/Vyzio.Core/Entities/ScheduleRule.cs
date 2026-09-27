using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Globalization;
using System.Text.Json;

namespace Vyzio.Core.Entities;

/// <summary>What a scheduled rule does to its targets during its range (ADR-63).</summary>
public enum ScheduleRuleKind
{
    /// <summary>The targeted cameras are in privacy mode (SPECS 9.2).</summary>
    Privacy,

    /// <summary>The targeted channels send no detection notification; recording goes on (SPECS 5.2).</summary>
    MuteNotifications,
}

/// <summary>What the identifiers of a rule's targets name.</summary>
public enum ScheduleTargetKind
{
    Camera,
    Channel,
}

/// <summary>What the user must change for a rule to be kept (SPECS 7.3).</summary>
public enum ScheduleRuleRefusal
{
    UnknownKind,
    NoDay,
    InvalidTime,
    EmptyRange,
    NoTarget,
    UnknownTarget,
}

public static class ScheduleRuleKinds
{
    /// <summary>The one place a type declares what it targets: a new type adds a line here (ADR-63).</summary>
    public static ScheduleTargetKind TargetOf(ScheduleRuleKind kind) => kind switch
    {
        ScheduleRuleKind.Privacy => ScheduleTargetKind.Camera,
        ScheduleRuleKind.MuteNotifications => ScheduleTargetKind.Channel,
        _ => throw new ArgumentOutOfRangeException(nameof(kind), kind, null),
    };
}

[Table("schedule_rules")]
public class ScheduleRule
{
    [Key]
    public string Id { get; set; } = Guid.NewGuid().ToString("N");

    public ScheduleRuleKind Kind { get; set; }

    // JSON array of ints [0..6] where 0 = Sunday
    [Required, MaxLength(50)]
    public required string DaysOfWeek { get; set; }

    // "HH:mm"
    [Required, MaxLength(5)]
    public required string StartTime { get; set; }

    // "HH:mm"; before StartTime, the range ends the next day (SPECS 7.3)
    [Required, MaxLength(5)]
    public required string EndTime { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public List<ScheduleRuleTarget> Targets { get; set; } = [];

    public IReadOnlyList<int> GetDaysOfWeek()
    {
        try
        {
            return JsonSerializer.Deserialize<List<int>>(DaysOfWeek) ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
    }

    public IReadOnlyList<string> GetTargetIds() => [.. Targets.Select(target => target.TargetId)];

    public bool IsTargeting(string targetId) => Targets.Any(target => target.TargetId == targetId);

    /// <summary>Keeps the targets still wanted and adds the new ones, so a tracked target is never duplicated.</summary>
    public void ReplaceTargets(IReadOnlyCollection<string> targetIds)
    {
        Targets.RemoveAll(target => !targetIds.Contains(target.TargetId));
        foreach (var targetId in targetIds.Where(id => !IsTargeting(id)))
            Targets.Add(new ScheduleRuleTarget { RuleId = Id, TargetId = targetId });
    }

    /// <summary>Why this range cannot be kept, or null when it can.</summary>
    public static ScheduleRuleRefusal? CheckRange(IReadOnlyList<int> daysOfWeek, string startTime, string endTime)
    {
        if (daysOfWeek.Count == 0 || daysOfWeek.Any(d => d is < 0 or > 6)) return ScheduleRuleRefusal.NoDay;
        if (!TryParseTime(startTime, out var start) || !TryParseTime(endTime, out var end))
            return ScheduleRuleRefusal.InvalidTime;
        return start == end ? ScheduleRuleRefusal.EmptyRange : null;
    }

    private static bool TryParseTime(string value, out TimeSpan time) =>
        TimeSpan.TryParseExact(value, @"hh\:mm", CultureInfo.InvariantCulture, out time);

    /// <summary>Whether the range holds this local moment; a range crossing midnight belongs to the day it starts.</summary>
    public bool Covers(DateTimeOffset localMoment)
    {
        if (!TryParseTime(StartTime, out var start) || !TryParseTime(EndTime, out var end) || start == end)
            return false;

        var day = (int)localMoment.DayOfWeek;
        var time = localMoment.TimeOfDay;
        var days = GetDaysOfWeek();
        if (start < end) return days.Contains(day) && time >= start && time < end;

        var previousDay = (day + 6) % 7;
        return (days.Contains(day) && time >= start) || (days.Contains(previousDay) && time < end);
    }
}

[Table("schedule_rule_targets")]
public class ScheduleRuleTarget
{
    [Required]
    public string RuleId { get; set; } = "";

    /// <summary>A camera id or a channel name, as the rule's kind declares; no foreign key (ADR-63).</summary>
    [Required, MaxLength(64)]
    public required string TargetId { get; set; }
}
