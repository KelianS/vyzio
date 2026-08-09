using System.Globalization;
using Vyzio.Application.DTOs.DetectionEvents;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.DetectionEvents;

public sealed class GetRecentDetectionEventsUseCase(
    IFrigateEventReader events,
    DetectionEventContractProjector projector)
{
    public async Task<IReadOnlyList<DetectionEventContract>> ExecuteAsync(int limit = 20, CancellationToken ct = default)
    {
        var detections = await events.QueryAsync(
            new FrigateDetectionQuery(Limit: Math.Clamp(limit, 1, 100)), ct);
        return await projector.ToContractsAsync(detections, ct);
    }
}

public sealed class GetProfileDetectionEventsUseCase(
    IProfileRepository profiles,
    IFrigateEventReader events,
    DetectionEventContractProjector projector)
{
    public async Task<IReadOnlyList<DetectionEventContract>> ExecuteAsync(
        string profileId,
        int limit = 20,
        CancellationToken ct = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(profileId);

        var profile = await profiles.GetByIdAsync(profileId, ct);
        if (profile is null)
            return [];

        // Frigate knows a profile by the name it was recognized under, never by its Vyzio id.
        var detections = await events.QueryAsync(
            new FrigateDetectionQuery(Identity: profile.Name, Limit: Math.Clamp(limit, 1, 100)), ct);
        return await projector.ToContractsAsync(detections, ct);
    }
}

public sealed class GetDetectionHistoryUseCase(
    IProfileRepository profiles,
    IFrigateEventReader events,
    DetectionEventContractProjector projector)
{
    public async Task<DetectionHistoryPageDto> ExecuteAsync(
        DetectionHistoryQuery query,
        CancellationToken ct = default)
    {
        var limit = Math.Clamp(query.Limit, 1, 100);

        string? identity = null;
        if (!string.IsNullOrWhiteSpace(query.ProfileId))
        {
            var profile = await profiles.GetByIdAsync(query.ProfileId, ct);
            // A profile renamed since is unreachable by its former name: Frigate kept what it saw.
            if (profile is null)
                return new DetectionHistoryPageDto([], null);

            identity = profile.Name;
        }

        var cursor = ParseCursor(query.Cursor);
        var before = cursor ?? query.To;

        var detections = await events.QueryAsync(
            new FrigateDetectionQuery(
                Camera: query.Camera,
                Label: query.Label,
                Identity: identity,
                After: query.From,
                Before: before,
                Limit: limit),
            ct);

        // A full page means Frigate may hold more; a short one means we reached the oldest detection.
        var nextCursor = detections.Count == limit
            ? FormatCursor(detections[^1].OccurredAt)
            : null;

        return new DetectionHistoryPageDto(await projector.ToContractsAsync(detections, ct), nextCursor);
    }

    private static DateTimeOffset? ParseCursor(string? cursor)
        => string.IsNullOrWhiteSpace(cursor)
            || !long.TryParse(cursor, NumberStyles.Integer, CultureInfo.InvariantCulture, out var milliseconds)
            ? null
            : DateTimeOffset.FromUnixTimeMilliseconds(milliseconds);

    private static string FormatCursor(DateTimeOffset moment)
        => moment.ToUnixTimeMilliseconds().ToString(CultureInfo.InvariantCulture);
}

public sealed class CorrectDetectionIdentityUseCase(
    IProfileRepository profiles,
    IFrigateIdentityWriter identities)
{
    public async Task<bool> ExecuteAsync(
        string frigateEventId,
        CorrectDetectionIdentityRequest request,
        CancellationToken ct = default)
    {
        string? identity = null;

        if (!string.IsNullOrWhiteSpace(request.ProfileId))
        {
            var profile = await profiles.GetByIdAsync(request.ProfileId, ct);
            if (profile is null)
                return false;

            // Frigate knows a profile by its name, the only thing it recognized in the first place.
            identity = profile.Name;
        }

        return await identities.TrySetIdentityAsync(frigateEventId, identity, ct);
    }
}
