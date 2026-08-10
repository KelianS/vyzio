using System.Text.Json;
using Vyzio.Core.Common;

namespace Vyzio.Core.Entities;

/// <summary>
/// The credentials of one channel, keyed by declared field rather than by column: a channel needing
/// a webhook and one needing a token/recipient pair share the same storage without sharing a shape (ADR-50).
/// </summary>
public sealed class ChannelCredentials
{
    private readonly Dictionary<ChannelCredential, string> _values;

    public ChannelCredentials() : this([]) { }

    public ChannelCredentials(IEnumerable<KeyValuePair<ChannelCredential, string>> values)
    {
        _values = values
            .Where(pair => !string.IsNullOrWhiteSpace(pair.Value))
            .ToDictionary(pair => pair.Key, pair => pair.Value.Trim());
    }

    public static ChannelCredentials Empty => new();

    public string? this[ChannelCredential field]
        => _values.TryGetValue(field, out var value) ? value : null;

    public bool Has(ChannelCredential field) => this[field] is not null;

    public IReadOnlyCollection<ChannelCredential> Fields => _values.Keys;

    /// <summary>Returns a copy where only the fields explicitly provided are replaced — an absent field keeps its stored value.</summary>
    public ChannelCredentials With(IReadOnlyDictionary<ChannelCredential, string?> updates)
    {
        var merged = new Dictionary<ChannelCredential, string>(_values);
        foreach (var (field, value) in updates)
        {
            if (string.IsNullOrWhiteSpace(value)) continue;
            merged[field] = value.Trim();
        }
        return new ChannelCredentials(merged);
    }

    public ChannelCredentials Without(ChannelCredential field)
        => new(_values.Where(pair => pair.Key != field));

    public static ChannelCredentials FromJson(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return Empty;

        try
        {
            var raw = JsonSerializer.Deserialize<Dictionary<string, string>>(json);
            if (raw is null) return Empty;

            var values = new Dictionary<ChannelCredential, string>();
            foreach (var (key, value) in raw)
            {
                if (SnakeCaseEnum.TryFromSnakeCase<ChannelCredential>(key, out var field))
                    values[field] = value;
            }
            return new ChannelCredentials(values);
        }
        catch (JsonException)
        {
            return Empty;
        }
    }

    public string? ToJson()
        => _values.Count == 0
            ? null
            : JsonSerializer.Serialize(_values.ToDictionary(
                pair => SnakeCaseEnum.ToSnakeCase(pair.Key),
                pair => pair.Value));
}
