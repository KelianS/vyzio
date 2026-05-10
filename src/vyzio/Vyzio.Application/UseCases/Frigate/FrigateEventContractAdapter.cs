using System.Text.Json;
using Vyzio.Application.DTOs.Frigate;

namespace Vyzio.Application.UseCases.Frigate;

public sealed class FrigateLabelFilter(IEnumerable<string>? retainedLabels = null)
{
    private readonly HashSet<string> _retainedLabels = retainedLabels?
        .Where(label => !string.IsNullOrWhiteSpace(label))
        .Select(Normalize)
        .ToHashSet(StringComparer.OrdinalIgnoreCase)
        ?? new HashSet<string>(StringComparer.OrdinalIgnoreCase);

    public IReadOnlyCollection<string> RetainedLabels => _retainedLabels;

    public bool Allows(string label)
    {
        if (string.IsNullOrWhiteSpace(label))
        {
            return false;
        }

        return _retainedLabels.Count == 0 || _retainedLabels.Contains(Normalize(label));
    }

    private static string Normalize(string label) => label.Trim().ToLowerInvariant();
}

public sealed class FrigateEventContractAdapter(FrigateLabelFilter labelFilter)
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private static readonly HashSet<string> SupportedLifecycleTypes =
        ["new", "update", "end"];

    public bool TryDeserialize(string payload, out FrigateEventEnvelope? envelope)
    {
        envelope = null;

        if (string.IsNullOrWhiteSpace(payload))
        {
            return false;
        }

        try
        {
            envelope = JsonSerializer.Deserialize<FrigateEventEnvelope>(payload, JsonOptions);
        }
        catch (JsonException)
        {
            return false;
        }

        return envelope is not null;
    }

    public bool TryAdapt(FrigateEventEnvelope envelope, out FrigateConsumedEvent? consumedEvent)
    {
        consumedEvent = null;

        var lifecycle = envelope.Type.Trim().ToLowerInvariant();
        if (!SupportedLifecycleTypes.Contains(lifecycle))
        {
            return false;
        }

        var source = envelope.After ?? envelope.Before;
        if (source is null
            || string.IsNullOrWhiteSpace(source.Id)
            || string.IsNullOrWhiteSpace(source.Camera)
            || string.IsNullOrWhiteSpace(source.Label)
            || !labelFilter.Allows(source.Label))
        {
            return false;
        }

        consumedEvent = new FrigateConsumedEvent(
            source.Id,
            lifecycle,
            source.Camera,
            source.Label,
            source.TopScore,
            ResolveOccurredAt(source, lifecycle),
            source.HasClip,
            source.HasSnapshot,
            source.EnteredZones?.Where(zone => !string.IsNullOrWhiteSpace(zone)).ToArray() ?? []);

        return true;
    }

    public bool TryParseRelevantEvent(string payload, out FrigateConsumedEvent? consumedEvent)
    {
        consumedEvent = null;

        return TryDeserialize(payload, out var envelope)
            && envelope is not null
            && TryAdapt(envelope, out consumedEvent);
    }

    private static DateTimeOffset ResolveOccurredAt(FrigateTrackedObject source, string lifecycle)
    {
        var unixSeconds = lifecycle == "end" ? source.EndTime ?? source.StartTime : source.StartTime;
        if (unixSeconds is null)
        {
            return DateTimeOffset.UtcNow;
        }

        return DateTimeOffset.FromUnixTimeMilliseconds((long)Math.Round(unixSeconds.Value * 1000));
    }
}