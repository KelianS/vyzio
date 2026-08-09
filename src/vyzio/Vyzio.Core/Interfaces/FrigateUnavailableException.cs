namespace Vyzio.Core.Interfaces;

/// <summary>
/// The surveillance did not answer. Distinct from an empty answer: nothing can be shown, and the
/// screen must say why rather than let it read as "no detection" (ADR-49).
/// </summary>
public sealed class FrigateUnavailableException(Exception inner)
    : Exception("The surveillance is not answering.", inner);
