namespace Vyzio.Application.DTOs.Scheduling;

/// <summary>At most one of the two: an end instant, or a duration in minutes from now; neither holds until the user ends it.</summary>
public sealed record ChosenEndRequest(DateTimeOffset? Until = null, int? Minutes = null);
