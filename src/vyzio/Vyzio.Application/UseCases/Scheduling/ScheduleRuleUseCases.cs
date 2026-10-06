using System.Text.Json;
using Vyzio.Application.DTOs.Scheduling;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Core.Common;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Scheduling;

/// <summary>A rule the user can fix, answered as a refusal naming what to change, never as a failure (SPECS 7.3).</summary>
public sealed class InvalidScheduleRuleException(ScheduleRuleRefusal refusal)
    : Exception(refusal switch
    {
        ScheduleRuleRefusal.UnknownKind => "The rule type is not one Vyzio knows.",
        ScheduleRuleRefusal.NoDay => "At least one day of week, 0 to 6, is required.",
        ScheduleRuleRefusal.InvalidTime => "Start and end must both be times written HH:mm.",
        ScheduleRuleRefusal.EmptyRange => "Start and end are the same time.",
        ScheduleRuleRefusal.NoTarget => "At least one target is required.",
        _ => "A target is not one this rule type can aim at.",
    })
{
    public ScheduleRuleRefusal Refusal { get; } = refusal;
}

/// <summary>Checks a rule whole before anything is stored: its range, then its targets in the kind its type declares.</summary>
public sealed class ScheduleRuleValidator(ICameraRepository cameras, INotificationChannelCatalog channels)
{
    public async Task ThrowIfRefusedAsync(
        ScheduleRuleKind kind,
        IReadOnlyList<string> targetIds,
        IReadOnlyList<int> daysOfWeek,
        string startTime,
        string endTime,
        CancellationToken ct)
    {
        if (ScheduleRule.CheckRange(daysOfWeek, startTime, endTime) is { } refusal)
            throw new InvalidScheduleRuleException(refusal);
        if (targetIds.Count == 0)
            throw new InvalidScheduleRuleException(ScheduleRuleRefusal.NoTarget);

        var known = await KnownTargetsAsync(ScheduleRuleKinds.TargetOf(kind), ct);
        if (targetIds.Any(id => !known.Contains(id)))
            throw new InvalidScheduleRuleException(ScheduleRuleRefusal.UnknownTarget);
    }

    private async Task<HashSet<string>> KnownTargetsAsync(ScheduleTargetKind kind, CancellationToken ct) => kind switch
    {
        ScheduleTargetKind.Camera => [.. (await cameras.GetAllAsync(ct)).Select(camera => camera.Id)],
        ScheduleTargetKind.Channel => [.. channels.Descriptors.Select(descriptor => SnakeCaseEnum.ToSnakeCase(descriptor.Channel))],
        _ => throw new ArgumentOutOfRangeException(nameof(kind), kind, null),
    };
}

public sealed class ListScheduleRulesUseCase(IScheduleRuleRepository rules)
{
    public async Task<IReadOnlyList<ScheduleRuleDto>> ExecuteAsync(CancellationToken ct = default)
        => [.. (await rules.GetAllAsync(ct)).Select(ScheduleRuleDto.From)];
}

public sealed class GetScheduleRuleUseCase(IScheduleRuleRepository rules)
{
    public async Task<ScheduleRuleDto?> ExecuteAsync(string id, CancellationToken ct = default)
        => await rules.GetByIdAsync(id, ct) is { } rule ? ScheduleRuleDto.From(rule) : null;
}

public sealed class CreateScheduleRuleUseCase(IScheduleRuleRepository rules, ScheduleRuleValidator validator, PrivacyResumes resumes)
{
    public async Task<ScheduleRuleDto> ExecuteAsync(CreateScheduleRuleRequest request, CancellationToken ct = default)
    {
        if (!SnakeCaseEnum.TryFromSnakeCase<ScheduleRuleKind>(request.Kind, out var kind) || !Enum.IsDefined(kind))
            throw new InvalidScheduleRuleException(ScheduleRuleRefusal.UnknownKind);

        var targetIds = (request.TargetIds ?? []).Distinct().ToList();
        var daysOfWeek = request.DaysOfWeek ?? [];
        await validator.ThrowIfRefusedAsync(kind, targetIds, daysOfWeek, request.StartTime, request.EndTime, ct);

        var rule = new ScheduleRule
        {
            Kind = kind,
            DaysOfWeek = JsonSerializer.Serialize(daysOfWeek.Distinct().Order()),
            StartTime = request.StartTime,
            EndTime = request.EndTime,
        };
        rule.ReplaceTargets(targetIds);

        await rules.AddAsync(rule, ct);
        resumes.EndFor(rule);
        return ScheduleRuleDto.From(rule);
    }
}

public sealed class UpdateScheduleRuleUseCase(IScheduleRuleRepository rules, ScheduleRuleValidator validator, PrivacyResumes resumes)
{
    public async Task<ScheduleRuleDto?> ExecuteAsync(string id, UpdateScheduleRuleRequest request, CancellationToken ct = default)
    {
        var rule = await rules.GetByIdAsync(id, ct);
        if (rule is null) return null;

        // Validated whole before anything changes, so a refusal leaves the tracked rule untouched.
        var targetIds = (request.TargetIds ?? []).Distinct().ToList();
        var daysOfWeek = request.DaysOfWeek ?? [];
        await validator.ThrowIfRefusedAsync(rule.Kind, targetIds, daysOfWeek, request.StartTime, request.EndTime, ct);

        rule.DaysOfWeek = JsonSerializer.Serialize(daysOfWeek.Distinct().Order());
        rule.StartTime = request.StartTime;
        rule.EndTime = request.EndTime;
        rule.ReplaceTargets(targetIds);

        await rules.UpdateAsync(rule, ct);
        resumes.EndFor(rule);
        return ScheduleRuleDto.From(rule);
    }
}

public sealed class DeleteScheduleRuleUseCase(IScheduleRuleRepository rules)
{
    public async Task<bool> ExecuteAsync(string id, CancellationToken ct = default)
    {
        var rule = await rules.GetByIdAsync(id, ct);
        if (rule is null) return false;
        await rules.DeleteAsync(rule, ct);
        return true;
    }
}

/// <summary>Whether a target is under a rule type's effect at a moment: any covering rule of that type targeting it (ADR-63).</summary>
public static class ScheduleRuleCoverage
{
    public static bool Covers(IEnumerable<ScheduleRule> rules, string targetId, DateTimeOffset localMoment)
        => rules.Any(rule => rule.IsTargeting(targetId) && rule.Covers(localMoment));

    /// <summary>The first moment after this one the target is out of every range, or null when the ranges never let it out.</summary>
    public static DateTimeOffset? EndOf(IReadOnlyList<ScheduleRule> rules, string targetId, DateTimeOffset localMoment)
    {
        var targeting = rules.Where(rule => rule.IsTargeting(targetId)).ToList();
        // Coverage can only stop where one of its ranges ends, so only those moments are tried, over a week and a day.
        return Enumerable.Range(0, 9)
            .SelectMany(day => targeting
                .Where(rule => rule.End.HasValue)
                .Select(rule => new DateTimeOffset(localMoment.Date.AddDays(day) + rule.End!.Value, localMoment.Offset)))
            .Where(end => end > localMoment)
            .Order()
            .Select(end => (DateTimeOffset?)end)
            .FirstOrDefault(end => !Covers(targeting, targetId, end!.Value));
    }
}

/// <summary>The current moment in the house's clock, for the week to mark: the device consulting may sit elsewhere (ADR-63).</summary>
public sealed class GetHouseClockUseCase(TimeZoneInfo timeZone, TimeProvider time)
{
    public HouseClockDto Execute() => HouseClockDto.Of(TimeZoneInfo.ConvertTime(time.GetUtcNow(), timeZone));
}
