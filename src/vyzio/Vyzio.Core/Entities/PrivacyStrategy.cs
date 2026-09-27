namespace Vyzio.Core.Entities;

// How a camera stops filming while privacy mode is on; the software stop comes first so it is the default (ADR-62).
public enum PrivacyStrategy
{
    SoftwareBlur,
    PtzParking,
    Hardware,
}
