namespace Vyzio.Core.Entities;

// What a stream serves in Frigate; one stream records and at most one detects (ADR-65).
public enum StreamRole
{
    None,
    Record,
    Detect,
    RecordAndDetect,
}

public static class StreamRoles
{
    public static bool Records(this StreamRole role) => role is StreamRole.Record or StreamRole.RecordAndDetect;

    public static bool Detects(this StreamRole role) => role is StreamRole.Detect or StreamRole.RecordAndDetect;

    public static StreamRole Of(bool records, bool detects) => (records, detects) switch
    {
        (true, true) => StreamRole.RecordAndDetect,
        (true, false) => StreamRole.Record,
        (false, true) => StreamRole.Detect,
        _ => StreamRole.None,
    };
}
