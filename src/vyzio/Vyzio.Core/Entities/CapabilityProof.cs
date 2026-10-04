namespace Vyzio.Core.Entities;

// What a capability's read-only check found over a protocol that already answered; a login is never a proof (ADR-66).
public enum ProofOutcome
{
    Proven,
    Missing,
    Unprovable,
}

// Detail is support detail naming what the camera answered, never a secret (SPECS 1.5).
public sealed record CapabilityProof(ProofOutcome Outcome, string? Detail)
{
    public static CapabilityProof Proven() => new(ProofOutcome.Proven, null);

    public static CapabilityProof Missing(string detail) => new(ProofOutcome.Missing, detail);

    public static CapabilityProof Unprovable() => new(ProofOutcome.Unprovable, null);
}
