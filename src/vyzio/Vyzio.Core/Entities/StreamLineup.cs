using Vyzio.Core.Interfaces;

namespace Vyzio.Core.Entities;

public enum StreamChange
{
    Done,
    // The stream records: another stream must take recording first (ADR-65 b).
    StreamRecords,
    // A disabled stream holds no role (ADR-65 b).
    StreamDisabled,
}

// The one place that changes a stream binding's streams, and holds its guard: exactly one enabled stream records (ADR-65).
public static class StreamLineup
{
    // One main stream over the protocol, recording and detecting, the others to be found again (ADR-65 e).
    public static CameraStream ResetTo(CameraCapabilityBinding binding, SupportedProtocol protocol, string? mainPath)
    {
        binding.Streams.Clear();
        binding.StreamsFoundAt = null;
        var main = new CameraStream
        {
            BindingId = binding.Id,
            Ordinal = 0,
            Protocol = protocol,
            Path = mainPath,
            Role = StreamRole.RecordAndDetect,
        };
        binding.Streams.Add(main);
        return main;
    }

    // The streams the camera reports, most detailed first: added once, then only their size is refreshed (ADR-65 e).
    public static void ApplyFound(CameraCapabilityBinding binding, IReadOnlyList<EnumeratedStream> found, DateTimeOffset at)
    {
        if (found.Count == 0) return;

        if (binding.StreamsFoundAt is null) AddFound(binding, found, at);

        foreach (var stream in binding.Streams)
        {
            // A size is only adopted for the address it describes: vendors alias their streams (ADR-38).
            var match = found.FirstOrDefault(entry => PathsMatch(stream.Path, entry.Path));
            if (match is null && stream.Ordinal != 0) continue;

            stream.Width = match?.Width;
            stream.Height = match?.Height;
            stream.Fps = match?.Fps;
            stream.UpdatedAt = at;
        }
    }

    public static StreamChange SetRole(CameraCapabilityBinding binding, CameraStream stream, StreamRole role)
    {
        if (!stream.Enabled && role != StreamRole.None) return StreamChange.StreamDisabled;
        if (stream.Records && !role.Records()) return StreamChange.StreamRecords;

        TakeRoles(binding, stream, role);
        stream.Role = role;
        stream.UpdatedAt = DateTimeOffset.UtcNow;
        return StreamChange.Done;
    }

    public static StreamChange SetEnabled(CameraStream stream, bool enabled)
    {
        if (!enabled && stream.Records) return StreamChange.StreamRecords;

        stream.Enabled = enabled;
        if (!enabled) stream.Role = StreamRole.None;
        stream.UpdatedAt = DateTimeOffset.UtcNow;
        return StreamChange.Done;
    }

    public static StreamChange Remove(CameraCapabilityBinding binding, CameraStream stream)
    {
        if (stream.Records) return StreamChange.StreamRecords;

        binding.Streams.Remove(stream);
        return StreamChange.Done;
    }

    // A stream declared by hand, at the next free rank; its role is taken from whichever stream had it.
    public static CameraStream Add(CameraCapabilityBinding binding, SupportedProtocol protocol, string? path, StreamRole role)
    {
        var stream = new CameraStream
        {
            BindingId = binding.Id,
            Ordinal = binding.Streams.Count == 0 ? 0 : binding.Streams.Max(entry => entry.Ordinal) + 1,
            Protocol = protocol,
            Path = path,
        };
        TakeRoles(binding, stream, role);
        stream.Role = role;
        binding.Streams.Add(stream);
        return stream;
    }

    private static void AddFound(CameraCapabilityBinding binding, IReadOnlyList<EnumeratedStream> found, DateTimeOffset at)
    {
        // Only a lineup still as onboarding left it takes the defaults: the user's choices are never redone.
        var untouched = binding.Streams.Count == 0
                        || (binding.Streams.Count == 1 && binding.Streams.Single().Role == StreamRole.RecordAndDetect);
        var next = binding.Streams.Count == 0 ? 0 : binding.Streams.Max(entry => entry.Ordinal) + 1;

        // The first reported stream is the main one, whose path is what the user entered and verified.
        foreach (var entry in found.Skip(binding.Streams.Count == 0 ? 0 : 1))
        {
            if (binding.Streams.Any(stream => PathsMatch(stream.Path, entry.Path))) continue;

            binding.Streams.Add(new CameraStream
            {
                BindingId = binding.Id,
                Ordinal = next++,
                Protocol = binding.Protocol,
                Path = entry.Path,
                Width = entry.Width,
                Height = entry.Height,
                Fps = entry.Fps,
                Role = binding.Streams.Count == 0 ? StreamRole.RecordAndDetect : StreamRole.None,
            });
        }

        // The most detailed records, the lightest detects: analysis is downscaled anyway (ADR-38).
        var ranked = binding.Streams.OrderBy(stream => stream.Ordinal).ToList();
        if (untouched && ranked.Count > 1)
        {
            ranked[0].Role = StreamRole.Record;
            ranked[^1].Role = StreamRole.Detect;
        }

        binding.StreamsFoundAt = at;
    }

    // Giving a role takes it from every other stream: Frigate takes one input per role (ADR-65 b).
    private static void TakeRoles(CameraCapabilityBinding binding, CameraStream stream, StreamRole role)
    {
        foreach (var other in binding.Streams.Where(entry => entry != stream))
        {
            other.Role = StreamRoles.Of(
                other.Role.Records() && !role.Records(),
                other.Role.Detects() && !role.Detects());
        }
    }

    private static bool PathsMatch(string? left, string? right)
        => string.Equals(left?.TrimStart('/'), right?.TrimStart('/'), StringComparison.OrdinalIgnoreCase);
}
