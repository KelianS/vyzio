using System.Text.RegularExpressions;

namespace Vyzio.Core.Entities;

/// <summary>
/// The shape Frigate gives every event id: its frame time, a dash, six random lowercase letters or digits.
/// </summary>
public static partial class FrigateEventId
{
    /// <summary>True when <paramref name="candidate"/> could be a Frigate event id; nothing else reaches Frigate or a log.</summary>
    public static bool IsWellFormed(string? candidate)
        => candidate is not null && Shape().IsMatch(candidate);

    [GeneratedRegex(@"^\d{1,12}\.\d{1,9}-[a-z0-9]{6}\z", RegexOptions.CultureInvariant)]
    private static partial Regex Shape();
}
