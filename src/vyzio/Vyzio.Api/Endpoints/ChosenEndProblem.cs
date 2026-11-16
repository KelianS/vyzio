using Vyzio.Core.Common;
using Vyzio.Core.Entities;

namespace Vyzio.Api.Endpoints;

/// <summary>A refused end, the Silence's or the cut's, named after what was being started.</summary>
internal static class ChosenEndProblem
{
    public static IResult Of(string subject, ChosenEndRefusal refusal) => ApiProblem.BadRequest(
        $"{subject}_{SnakeCaseEnum.ToSnakeCase(refusal)}",
        refusal switch
        {
            ChosenEndRefusal.TwoEnds => "Give an end instant or a duration in minutes, not both; neither holds until it is ended.",
            ChosenEndRefusal.EndNotAhead => "The end must be after now.",
            ChosenEndRefusal.TooLong => "A chosen end lies a week ahead at most.",
            _ => throw new ArgumentOutOfRangeException(nameof(refusal), refusal, null),
        });
}
