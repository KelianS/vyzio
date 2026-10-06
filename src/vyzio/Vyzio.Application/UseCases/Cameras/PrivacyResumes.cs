using System.Collections.Concurrent;
using Vyzio.Application.DTOs.Cameras;
using Vyzio.Application.DTOs.Scheduling;
using Vyzio.Application.UseCases.Scheduling;
using Vyzio.Core.Entities;

namespace Vyzio.Application.UseCases.Cameras;

/// <summary>Cameras resumed by hand inside a Privacy range, until it ends; in memory, so a restart applies the ranges again (SPECS 9.2).</summary>
public sealed class PrivacyResumes(TimeZoneInfo timeZone, TimeProvider time)
{
    // The moment each resume ends, or null when the ranges never let the camera out.
    private readonly ConcurrentDictionary<string, DateTimeOffset?> _resumed = new();

    private DateTimeOffset HouseNow() => TimeZoneInfo.ConvertTime(time.GetUtcNow(), timeZone);

    /// <summary>Held only inside a range: outside one there is nothing to resume from.</summary>
    public void Resume(string cameraId, IReadOnlyList<ScheduleRule> privacyRules)
    {
        var now = HouseNow();
        if (ScheduleRuleCoverage.Covers(privacyRules, cameraId, now))
            _resumed[cameraId] = ScheduleRuleCoverage.EndOf(privacyRules, cameraId, now);
    }

    public void End(string cameraId) => _resumed.TryRemove(cameraId, out _);

    /// <summary>A Privacy range saved applies within the minute, resumed or not (SPECS 7.3).</summary>
    public void EndFor(ScheduleRule rule)
    {
        if (rule.Kind != ScheduleRuleKind.Privacy) return;
        foreach (var cameraId in rule.GetTargetIds())
            End(cameraId);
    }

    /// <summary>Ended at its moment even when no scheduler pass saw the gap before the next range (SPECS 9.2).</summary>
    public bool Holds(string cameraId)
    {
        if (!_resumed.TryGetValue(cameraId, out var end)) return false;
        if (end is null || HouseNow() < end) return true;
        End(cameraId);
        return false;
    }

    /// <summary>The camera's resume while a range covers it, or null when it is not resumed.</summary>
    public PrivacyResumeDto? StateOf(string cameraId, IReadOnlyList<ScheduleRule> privacyRules)
    {
        var now = HouseNow();
        if (!Holds(cameraId) || !ScheduleRuleCoverage.Covers(privacyRules, cameraId, now))
            return null;
        return new PrivacyResumeDto(ScheduleRuleCoverage.EndOf(privacyRules, cameraId, now) is { } until ? HouseClockDto.Of(until) : null);
    }
}
