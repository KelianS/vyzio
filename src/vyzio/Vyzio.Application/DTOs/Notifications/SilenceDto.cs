using System.Globalization;

namespace Vyzio.Application.DTOs.Notifications;

/// <param name="At">The instant, written with the house's offset.</param>
/// <param name="DayOfWeek">0 = Sunday, in the house's clock.</param>
/// <param name="Time">"HH:mm" in the house's clock, never the consulting device's (SCHED-03).</param>
public sealed record HouseMomentDto(DateTimeOffset At, int DayOfWeek, string Time)
{
    public static HouseMomentDto Of(DateTimeOffset instant, TimeZoneInfo timeZone)
    {
        var house = TimeZoneInfo.ConvertTime(instant, timeZone);
        return new HouseMomentDto(house, (int)house.DayOfWeek, house.ToString("HH:mm", CultureInfo.InvariantCulture));
    }
}

/// <param name="Active">Whether notifications are held right now; an expired Silence is not active.</param>
/// <param name="Until">When the active Silence ends, or null when none is active.</param>
/// <param name="ScheduleNextChange">When the mute ranges next start or stop, or null when there is none.</param>
public sealed record SilenceDto(bool Active, HouseMomentDto? Until, HouseMomentDto? ScheduleNextChange);

/// <summary>Exactly one of the two: an end instant, or a duration in minutes from now.</summary>
public sealed record StartSilenceRequest(DateTimeOffset? Until = null, int? Minutes = null);
