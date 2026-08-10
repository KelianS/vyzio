using Vyzio.Core.Entities;

namespace Vyzio.Application.UseCases.Notifications;

/// <summary>
/// Turns a detection into what Vyzio has to say, never into markup: emphasis, escaping and length
/// belong to the channel that renders it (ADR-50).
/// </summary>
public sealed class DetectionMessageFormatter(TimeZoneInfo timeZone)
{
    public DetectionMessageFormatter() : this(TimeZoneInfo.Local) { }

    public ChannelMessage Format(FrigateDetection detection, IReadOnlySet<MessageField>? enabledFields = null)
    {
        ArgumentNullException.ThrowIfNull(detection);
        enabledFields ??= MessageFields.All;

        var hasIdentity = !string.IsNullOrWhiteSpace(detection.Identity);
        var emoji = hasIdentity ? "🧑" : LabelEmoji(detection.Label);
        var subject = hasIdentity
            ? $"{detection.Identity} detectee"
            : (enabledFields.Contains(MessageField.Label) ? $"Detection {detection.Label}" : "Detection");

        var details = new List<string>();

        if (enabledFields.Contains(MessageField.Camera))
            details.Add($"📷 {detection.Camera.Replace('_', ' ')}");

        if (enabledFields.Contains(MessageField.Time))
            details.Add($"🕐 {TimeZoneInfo.ConvertTime(detection.OccurredAt, timeZone):HH:mm}");

        if (enabledFields.Contains(MessageField.Confidence) && detection.Confidence.HasValue)
            details.Add($"{(int)Math.Round(detection.Confidence.Value * 100)} %");

        return new ChannelMessage($"{emoji} {subject}", details);
    }

    private static string LabelEmoji(string label) => label.ToLowerInvariant() switch
    {
        "person"       => "🚶",
        "person_known" => "🧑",
        "face"         => "👤",
        "cat"          => "🐱",
        "dog"          => "🐕",
        "car"          => "🚗",
        "bicycle"      => "🚲",
        "motorcycle"   => "🏍",
        "truck"        => "🚛",
        "bird"         => "🐦",
        "deer"         => "🦌",
        _              => "📡"
    };
}
