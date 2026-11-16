using Vyzio.Application.DTOs.Scheduling;
using Vyzio.Core.Entities;

namespace Vyzio.Application.UseCases.Scheduling;

/// <summary>The end the user picked from a sheet, a Silence's or a cut's: null holds until the user ends it (ADR-15).</summary>
public sealed record ChosenEnd(DateTimeOffset? End, ChosenEndRefusal? Refusal)
{
    // Long enough to reach any next change of a weekly schedule, short enough that a timed end stays what the sheet offers.
    private static readonly TimeSpan Longest = TimeSpan.FromDays(7);

    public static ChosenEnd Of(ChosenEndRequest request, DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (request.Until.HasValue && request.Minutes.HasValue)
            return new ChosenEnd(null, ChosenEndRefusal.TwoEnds);
        if (request is { Until: null, Minutes: null })
            return new ChosenEnd(null, null);

        // Clamped first, so a huge duration is refused as too long rather than overflowing the clock.
        var end = request.Until ?? now.AddMinutes(Math.Min(request.Minutes!.Value, Longest.TotalMinutes + 1));
        if (end <= now)
            return new ChosenEnd(null, ChosenEndRefusal.EndNotAhead);
        if (end - now > Longest)
            return new ChosenEnd(null, ChosenEndRefusal.TooLong);
        return new ChosenEnd(end, null);
    }
}
