using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

/// <summary>What a camera said of its own account when asked for its stream (ADR-58).</summary>
public enum RtspAccountCheck
{
    /// <summary>The camera let Vyzio in, or asked for no account at all.</summary>
    Accepted,

    /// <summary>The camera asked for an account and refused the one Vyzio holds, or Vyzio holds none.</summary>
    Refused,

    /// <summary>No readable answer: the camera is away, or speaks no RTSP on that port.</summary>
    NoAnswer,
}

// One authenticated DESCRIBE at most, never a guessed account (ADR-58).
public interface IRtspAccountProbe
{
    Task<RtspAccountCheck> CheckAsync(Camera camera, CancellationToken ct = default);
}
