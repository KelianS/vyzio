namespace Vyzio.Core.Entities;

public static class KnownDetectionLabels
{
    public static readonly IReadOnlyList<string> All =
    [
        "person", "face", "car", "motorcycle", "bicycle",
        "dog", "cat", "bird", "deer"
    ];

    public static bool IsValid(string label)
        => All.Contains(label, StringComparer.OrdinalIgnoreCase);
}
