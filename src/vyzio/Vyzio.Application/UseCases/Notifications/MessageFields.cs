using System.Text.Json;
using Vyzio.Core.Common;
using Vyzio.Core.Entities;

namespace Vyzio.Application.UseCases.Notifications;

/// <summary>Reads the stored field selection back, tolerating anything a past version wrote.</summary>
public static class MessageFields
{
    public static IReadOnlySet<MessageField> All { get; } = Enum.GetValues<MessageField>().ToHashSet();

    public static IReadOnlySet<MessageField> Parse(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return All;

        try
        {
            var raw = JsonSerializer.Deserialize<string[]>(json);
            if (raw is not { Length: > 0 }) return All;

            var fields = raw
                .Select(value => SnakeCaseEnum.TryFromSnakeCase<MessageField>(value, out var field)
                    ? (MessageField?)field
                    : null)
                .OfType<MessageField>()
                .ToHashSet();

            return fields.Count > 0 ? fields : All;
        }
        catch (JsonException)
        {
            return All;
        }
    }

    public static string Serialize(IEnumerable<MessageField> fields)
        => JsonSerializer.Serialize(fields.Select(SnakeCaseEnum.ToSnakeCase).ToArray());
}
