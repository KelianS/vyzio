namespace Vyzio.Core.Entities;

// Where a protocol stands after its check: reach, then login with the protocol's account (ADR-61).
public enum ProtocolStatus
{
    // Reached, and the account was accepted (or none was asked for).
    Answers,

    // Reached, but the camera turned the account or the device number down.
    Refused,

    // Nothing answered on the protocol's port or address.
    Unreachable,
}
