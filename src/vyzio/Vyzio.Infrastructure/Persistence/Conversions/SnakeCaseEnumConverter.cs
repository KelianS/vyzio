using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Vyzio.Core.Common;

namespace Vyzio.Infrastructure.Persistence.Conversions;

// Single generic EF Core converter for every "closed set" enum on Camera (ADR-22 point 0).
// The column is TEXT holding the snake_case name of the member ("tplink_tapo", "rtsp", "manual").
public sealed class SnakeCaseEnumConverter<TEnum> : ValueConverter<TEnum, string>
    where TEnum : struct, Enum
{
    public SnakeCaseEnumConverter() : base(
        v => SnakeCaseEnum.ToSnakeCase(v),
        v => SnakeCaseEnum.FromSnakeCase<TEnum>(v))
    {
    }
}

public sealed class NullableSnakeCaseEnumConverter<TEnum> : ValueConverter<TEnum?, string?>
    where TEnum : struct, Enum
{
    public NullableSnakeCaseEnumConverter() : base(
        v => v.HasValue ? SnakeCaseEnum.ToSnakeCase(v.Value) : null,
        // Empty string treated the same as SQL NULL — both map to null enum.
        v => string.IsNullOrWhiteSpace(v) ? null : (TEnum?)SnakeCaseEnum.FromSnakeCase<TEnum>(v))
    {
    }
}
