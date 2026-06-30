using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Vyzio.Core.Common;

namespace Vyzio.Infrastructure.Persistence.Conversions;

// Single generic EF Core converter for every "closed set" enum on Camera (ADR-22 point 0).
// Column stays TEXT with the exact same values already stored ("tplink_tapo", "rtsp",
// "manual", "ptz_parking"...) — no schema change, no data migration.
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
        v => v == null ? null : (TEnum?)SnakeCaseEnum.FromSnakeCase<TEnum>(v))
    {
    }
}
