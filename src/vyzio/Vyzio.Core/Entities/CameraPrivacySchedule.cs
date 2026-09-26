using System.Globalization;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json;

namespace Vyzio.Core.Entities;

/// <summary>What the user must change for a schedule to be kept (SPECS 9.2).</summary>
public enum PrivacyScheduleRefusal
{
    NoDay,
    InvalidTime,
    EmptyRange,
}

[Table("camera_privacy_schedules")]
public class CameraPrivacySchedule
{
    [Key]
    public string Id { get; set; } = Guid.NewGuid().ToString("N");

    [Required]
    public required string CameraId { get; set; }

    public Camera? Camera { get; set; }

    public bool Enabled { get; set; } = true;

    // JSON array of ints [0..6] where 0 = Sunday
    [Required, MaxLength(50)]
    public required string DaysOfWeek { get; set; }

    // "HH:mm"
    [Required, MaxLength(5)]
    public required string StartTime { get; set; }

    // "HH:mm"; before StartTime, the range ends the next day (SPECS 9.2)
    [Required, MaxLength(5)]
    public required string EndTime { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

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

    /// <summary>Why this schedule cannot be kept, or null when it can.</summary>
    public static PrivacyScheduleRefusal? Check(IReadOnlyList<int> daysOfWeek, string startTime, string endTime)
    {
        if (daysOfWeek.Count == 0 || daysOfWeek.Any(d => d is < 0 or > 6)) return PrivacyScheduleRefusal.NoDay;
        if (!TryParseTime(startTime, out var start) || !TryParseTime(endTime, out var end))
            return PrivacyScheduleRefusal.InvalidTime;
        return start == end ? PrivacyScheduleRefusal.EmptyRange : null;
    }

    private static bool TryParseTime(string value, out TimeSpan time) =>
        TimeSpan.TryParseExact(value, @"hh\:mm", CultureInfo.InvariantCulture, out time);

    public TimeSpan GetStartTime() => TimeSpan.Parse(StartTime, CultureInfo.InvariantCulture);
    public TimeSpan GetEndTime() => TimeSpan.Parse(EndTime, CultureInfo.InvariantCulture);

    /// <summary>Whether the range holds this moment; a range crossing midnight belongs to the day it starts.</summary>
    public bool Covers(int dayOfWeek, TimeSpan time)
    {
        var start = GetStartTime();
        var end = GetEndTime();
        var days = GetDaysOfWeek();
        if (start < end) return days.Contains(dayOfWeek) && time >= start && time < end;
        if (start == end) return false;

        var previousDay = (dayOfWeek + 6) % 7;
        return (days.Contains(dayOfWeek) && time >= start) || (days.Contains(previousDay) && time < end);
    }
}
