using Microsoft.Extensions.Logging;
using Vyzio.Application.DTOs.Notifications;
using Vyzio.Application.DTOs.Scheduling;
using Vyzio.Application.UseCases.Scheduling;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Notifications;

/// <summary>The Silence as the home shows it, with the moment the mute ranges take over again.</summary>
public sealed class GetSilenceUseCase(
    INotificationSilenceRepository silences,
    ScheduleNextChange scheduleNextChange,
    TimeZoneInfo timeZone,
    TimeProvider time)
{
    public async Task<SilenceDto> ExecuteAsync(CancellationToken ct = default)
    {
        var now = time.GetUtcNow();
        var silence = await silences.GetAsync(ct);

        var active = silence is not null && silence.Covers(now);
        return new SilenceDto(
            active,
            active && silence!.Until is { } until ? HouseMomentDto.Of(until, timeZone) : null,
            await scheduleNextChange.OfAsync(ScheduleRuleKind.MuteNotifications, now, ct));
    }
}

/// <summary>The Silence started, or why it was not.</summary>
public sealed record StartSilenceResult(SilenceDto? Silence, ChosenEndRefusal? Refusal);

/// <summary>Holds every notification until an instant, or until the user ends it; a Silence already running is replaced.</summary>
public sealed class StartSilenceUseCase(
    INotificationSilenceRepository silences,
    GetSilenceUseCase state,
    TimeProvider time,
    ILogger<StartSilenceUseCase> logger)
{
    public async Task<StartSilenceResult> ExecuteAsync(ChosenEndRequest request, CancellationToken ct = default)
    {
        var now = time.GetUtcNow();
        var end = ChosenEnd.Of(request, now);
        if (end.Refusal is { } refusal)
            return new StartSilenceResult(null, refusal);

        await silences.SaveAsync(new NotificationSilence { StartedAt = now, Until = end.End }, ct);
        if (end.End is { } until)
            logger.LogInformation("Silence started: no notification is sent until {Until}", until);
        else
            logger.LogInformation("Silence started: no notification is sent until the user ends it");
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
