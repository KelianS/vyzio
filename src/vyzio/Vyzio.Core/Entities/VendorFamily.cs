namespace Vyzio.Core.Entities;

// Purely descriptive identifier (display, vendors/*.md lookup, preset selection at onboarding).
// Does not drive any functional resolution — see CapabilityProtocol (ADR-22).
// Member names are chosen so JsonNamingPolicy.SnakeCaseLower(name) matches the legacy string
// values already stored in the database ("tplink_tapo", "icsee", "v380_pro") — do not rename
// without checking SnakeCaseEnumConverter round-trips against those exact values.
public enum VendorFamily
{
    TplinkTapo,
    Icsee,
    V380Pro,
}
