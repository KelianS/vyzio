using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.DetectionEvents;

/// <summary>
/// Resolves the identity Frigate attributes to a detection into a Vyzio profile.
/// Scoped: the caches below live for one request or one ingested message, never longer.
/// </summary>
public sealed class DetectionProfileResolver(
    IProfileRepository profiles,
    IProfileCameraLinkRepository profileCameraLinks)
{
    private IReadOnlyList<Profile>? _profiles;
    private readonly Dictionary<string, IReadOnlyList<ProfileCameraLink>> _linksByProfile = [];

    /// <summary>
    /// Returns the profile matching <paramref name="identity"/>, or null when no profile bears that
    /// name or when it is not linked to <paramref name="camera"/> (ADR-15).
    /// </summary>
    public async Task<string?> ResolveProfileIdAsync(string? identity, string camera, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(identity))
            return null;

        _profiles ??= await profiles.GetAllAsync(ct);
        var profile = _profiles.FirstOrDefault(p =>
            string.Equals(p.Name, identity, StringComparison.OrdinalIgnoreCase));

        if (profile is null)
            return null;

        if (!_linksByProfile.TryGetValue(profile.Id, out var links))
        {
            links = await profileCameraLinks.GetByProfileIdAsync(profile.Id, ct);
            _linksByProfile[profile.Id] = links;
        }

        var activeLinks = links.Where(link => link.Enabled).ToList();

        // No link at all means no restriction; one link means the profile is only recognized there.
        if (activeLinks.Count > 0 && !activeLinks.Any(link => string.Equals(link.CameraId, camera, StringComparison.Ordinal)))
            return null;

        return profile.Id;
    }
}
