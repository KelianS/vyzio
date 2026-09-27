using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.DetectionEvents;

/// <summary>
/// Resolves the identity Frigate attributes to a detection into a Vyzio profile, on every camera (ADR-58).
/// Scoped: the cache below lives for one request or one ingested message, never longer.
/// </summary>
public sealed class DetectionProfileResolver(IProfileRepository profiles)
{
    private IReadOnlyList<Profile>? _profiles;

    /// <summary>Returns the profile bearing <paramref name="identity"/>, or null when none does.</summary>
    public async Task<Profile?> ResolveProfileAsync(string? identity, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(identity))
            return null;

        _profiles ??= await profiles.GetAllAsync(ct);
        return _profiles.FirstOrDefault(p =>
            string.Equals(p.Name, identity, StringComparison.OrdinalIgnoreCase));
    }
}
