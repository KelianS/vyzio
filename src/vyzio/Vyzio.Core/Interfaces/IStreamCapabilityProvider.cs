using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

// Declares which SupportedProtocol carries the base video stream (ADR-32). Unlike the other
// capability providers, Stream has no runtime action Vyzio performs — the transport is handed to
// go2rtc/Frigate at config time (ADR-19), so this provider only *declares* the protocol. It exists
// so Stream is a first-class capability in ICapabilityProviderRegistry.GetRegisteredProtocols,
// resolved uniformly like Ptz/HardwarePrivacy/ImageSettings rather than as a special case.
public interface IStreamCapabilityProvider
{
    SupportedProtocol Protocol { get; }
}
