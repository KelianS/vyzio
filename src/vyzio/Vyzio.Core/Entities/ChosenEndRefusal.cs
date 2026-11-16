namespace Vyzio.Core.Entities;

/// <summary>Why the end the user chose for a Silence or a cut of every camera was refused.</summary>
public enum ChosenEndRefusal
{
    /// <summary>Both an end instant and a duration were given.</summary>
    TwoEnds,

    /// <summary>The end is not after now.</summary>
    EndNotAhead,

    /// <summary>The end lies beyond the week a chosen end may reach.</summary>
    TooLong,
}
