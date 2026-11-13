namespace Vyzio.Core.Entities;

// Whether a recognised person is signalled at all; it rules notifications only (ADR-13).
public enum ProfileAlertMode
{
    Always,
    Never,
}
