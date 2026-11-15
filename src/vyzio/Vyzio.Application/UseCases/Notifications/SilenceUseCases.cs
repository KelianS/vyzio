using Microsoft.Extensions.Logging;
using Vyzio.Application.DTOs.Notifications;
using Vyzio.Application.UseCases.Scheduling;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Notifications;

/// <summary>The Silence as the home shows it, with the moment the mute ranges take over again.</summary>
public sealed class GetSilenceUseCase(
    INotificationSilenceRepository silences,
    IScheduleRuleRepository scheduleRules,
    TimeZoneInfo timeZone,
    TimeProvider time)
{
    public async Task<SilenceDto> ExecuteAsync(CancellationToken ct = default)
    {
        var now = time.GetUtcNow();
        var silence = await silences.GetAsync(ct);
        var muteRules = await scheduleRules.GetByKindAsync(ScheduleRuleKind.MuteNotifications, ct);

        var active = silence is not null && silence.Covers(now);
        var nextChange = ScheduleChanges.Next(muteRules, now, timeZone);

        return new SilenceDto(
            active,
            active ? HouseMomentDto.Of(silence!.Until, timeZone) : null,
            nextChange is { } change ? HouseMomentDto.Of(change, timeZone) : null);
    }
}

/// <summary>The Silence started, or why it was not.</summary>
public sealed record StartSilenceResult(SilenceDto? Silence, SilenceRefusal? Refusal);

/// <summary>Holds every notification until an instant; a Silence already running is replaced.</summary>
public sealed class StartSilenceUseCase(
    INotificationSilenceRepository silences,
    GetSilenceUseCase state,
    TimeProvider time,
    ILogger<StartSilenceUseCase> logger)
{
    // Long enough to reach any next change of a weekly schedule, short enough that a forgotten Silence ends on its own.
    private static readonly TimeSpan LongestSilence = TimeSpan.FromDays(7);

    public async Task<StartSilenceResult> ExecuteAsync(StartSilenceRequest request, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var now = time.GetUtcNow();
        if (request.Until.HasValue == request.Minutes.HasValue)
            return new StartSilenceResult(null, SilenceRefusal.NoSingleEnd);

        // Clamped first, so a huge duration is refused as too long rather than overflowing the clock.
        var until = request.Until ?? now.AddMinutes(Math.Min(request.Minutes!.Value, LongestSilence.TotalMinutes + 1));
        if (until <= now)
            return new StartSilenceResult(null, SilenceRefusal.EndNotAhead);
        if (until - now > LongestSilence)
            return new StartSilenceResult(null, SilenceRefusal.TooLong);

        await silences.SaveAsync(new NotificationSilence { StartedAt = now, Until = until }, ct);
        logger.LogInformation("Silence started: no notification is sent until {Until}", until);
        return new StartSilenceResult(await state.ExecuteAsync(ct), null);
    }
}

public sealed class StopSilenceUseCase(
    INotificationSilenceRepository silences,
    GetSilenceUseCase state,
    ILogger<StopSilenceUseCase> logger)
{
    public async Task<SilenceDto> ExecuteAsync(CancellationToken ct = default)
    {
        await silences.ClearAsync(ct);
        logger.LogInformation("Silence ended by the user: notifications are sent again");
        return await state.ExecuteAsync(ct);
    }
}
