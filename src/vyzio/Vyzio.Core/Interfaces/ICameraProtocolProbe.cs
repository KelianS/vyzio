using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

// The protocol level's own check, apart from the capability's: does the camera answer here with this account (ADR-61).
public interface ICameraProtocolProbe
{
    Task<ProtocolAnswer> ProbeAsync(Camera camera, SupportedProtocol protocol, CancellationToken ct = default);
}

// Error is support detail naming the protocol, the port and what the camera said, never a secret (SPECS 1.5).
public sealed record ProtocolAnswer(ProtocolStatus Status, string? Error)
{
    public static ProtocolAnswer Answers() => new(ProtocolStatus.Answers, null);

    public static ProtocolAnswer Refused(string error) => new(ProtocolStatus.Refused, error);

    public static ProtocolAnswer Unreachable(string error) => new(ProtocolStatus.Unreachable, error);
}
