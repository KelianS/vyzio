using Vyzio.Core.Common;
using Vyzio.Core.Entities;

namespace Vyzio.Application.UseCases.Profiles;

internal static class ProfileAlertModes
{
    // An absent or unknown mode signals the person: hiding an alert must be the user's choice.
    public static ProfileAlertMode FromRequest(string? mode) =>
        SnakeCaseEnum.TryFromSnakeCase<ProfileAlertMode>(mode, out var parsed) && Enum.IsDefined(parsed)
            ? parsed
            : ProfileAlertMode.Always;
}
