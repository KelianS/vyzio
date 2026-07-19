using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.CapabilityProviders;

// The two base video transports Vyzio knows how to hand to go2rtc/Frigate (ADR-19). They carry no
// behaviour — they only declare their protocol so Stream is a normal capability in the registry
// (ADR-32). Adding a future stream transport = one more provider registered in DI, exactly like
// adding a PTZ/privacy/image provider.
public sealed class RtspStreamProvider : IStreamCapabilityProvider
{
    public SupportedProtocol Protocol => SupportedProtocol.Rtsp;
}

public sealed class DvripStreamProvider : IStreamCapabilityProvider
{
    public SupportedProtocol Protocol => SupportedProtocol.Dvrip;
}
