namespace Vyzio.Core.Common;

public static class CameraNaming
{
    /// <summary>
    /// Name a camera answers to in Frigate. Cameras onboarded before the column existed have none,
    /// and fall back to their slug — Frigate keys refuse dashes.
    /// </summary>
    public static string ToFrigateName(string? frigateCameraName, string slug)
        => frigateCameraName ?? slug.Replace('-', '_');
}
