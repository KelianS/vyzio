namespace Vyzio.Core.Entities;

// Health tri-state exposed to the Hub (ADR-33). Never compare/serialize as a raw string —
// SnakeCaseEnum.ToSnakeCase converts to the wire format at the DTO boundary.
public enum FrigateStatus
{
    Active,
    Restarting,
    Unavailable,
}
