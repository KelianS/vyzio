using System.Globalization;
using System.Text;
using Vyzio.Application.DTOs.Cameras;

namespace Vyzio.Application.Commands;

/// <summary>
/// Finds the camera someone meant. In a conversation one writes « Entrée », not a slug: matching has
/// to forgive accents and case, or the command is unusable from a phone.
/// </summary>
public static class CommandCameraLookup
{
    public static CameraDto? Resolve(IReadOnlyList<CameraDto> cameras, string? asked)
    {
        ArgumentNullException.ThrowIfNull(cameras);

        if (asked is null) return cameras.Count == 1 ? cameras[0] : null;

        var wanted = Simplify(asked);
        return cameras.FirstOrDefault(camera => Simplify(camera.DisplayName) == wanted)
               ?? cameras.FirstOrDefault(camera => Simplify(camera.Slug) == wanted)
               ?? cameras.FirstOrDefault(camera => Simplify(camera.DisplayName).StartsWith(wanted, StringComparison.Ordinal));
    }

    /// <summary>The form one can type on a phone keyboard: no accent, no case, no separator.</summary>
    public static string Simplify(string value)
    {
        ArgumentNullException.ThrowIfNull(value);

        var stripped = new StringBuilder(value.Length);
        foreach (var character in value.Normalize(NormalizationForm.FormD))
        {
            if (CharUnicodeInfo.GetUnicodeCategory(character) == UnicodeCategory.NonSpacingMark) continue;
            if (char.IsLetterOrDigit(character)) stripped.Append(char.ToLowerInvariant(character));
        }
        return stripped.ToString();
    }
}
