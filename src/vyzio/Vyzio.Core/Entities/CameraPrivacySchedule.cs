using System.Globalization;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json;

namespace Vyzio.Core.Entities;

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
