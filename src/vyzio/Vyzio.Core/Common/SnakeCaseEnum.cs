using System.Text.Json;

namespace Vyzio.Core.Common;

// Single source of truth for enum <-> snake_case string conversion (ADR-22 point 0).
// Used both by EF Core persistence (Vyzio.Infrastructure) and by any boundary that needs to
// parse a free-form string (API request, discovery heuristic) into a typed enum.
public static class SnakeCaseEnum
{
    public static string ToSnakeCase<TEnum>(TEnum value) where TEnum : struct, Enum
        => JsonNamingPolicy.SnakeCaseLower.ConvertName(value.ToString());

    public static TEnum FromSnakeCase<TEnum>(string value) where TEnum : struct, Enum
        => Enum.Parse<TEnum>(ToPascalCase(value), ignoreCase: true);

    public static bool TryFromSnakeCase<TEnum>(string? value, out TEnum result) where TEnum : struct, Enum
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            result = default;
            return false;
        }

        return Enum.TryParse(ToPascalCase(value), ignoreCase: true, out result);
    }

    private static string ToPascalCase(string snake)
        => string.Concat(snake.Split('_', StringSplitOptions.RemoveEmptyEntries)
            .Select(s => char.ToUpperInvariant(s[0]) + s[1..]));
}
