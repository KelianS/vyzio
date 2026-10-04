using Vyzio.Core.Interfaces;

namespace Vyzio.Core.Entities;

public enum StreamChange
{
    Done,
    // The stream records: another stream must take recording first (ADR-65 b).
    StreamRecords,
}

// A stream the camera serves, offered on demand by quality; StreamId names the line it already is, if any (ADR-65 e).
public sealed record StreamOffer(int Rank, string? Path, int? Width, int? Height, int? Fps, string? StreamId);

// The one place that changes a stream binding's streams, and holds its guard: exactly one stream records (ADR-65).
public static class StreamLineup
{
    // One stream over the protocol, recording and detecting: DVRIP's main quality or a typed RTSP path (ADR-65 e).
    public static CameraStream ResetTo(CameraCapabilityBinding binding, SupportedProtocol protocol, string? path)
    {
        binding.Streams.Clear();
        binding.StreamsFoundAt = null;
        var stream = new CameraStream
        {
            BindingId = binding.Id,
            Ordinal = 0,
            Protocol = protocol,
            Path = path,
            Role = StreamRole.RecordAndDetect,
        };
        binding.Streams.Add(stream);
        return stream;
    }

    // The streams the camera reports over the protocol replace every stream, with the defaults (ADR-65 d, e).
    public static void ResetToFound(CameraCapabilityBinding binding, SupportedProtocol protocol, IReadOnlyList<EnumeratedStream> found, DateTimeOffset at)
    {
        binding.Streams.Clear();
        binding.StreamsFoundAt = null;
        AddFound(binding, protocol, found, at);
    }

    // The streams the camera reports, most detailed first: added once, then only their size is refreshed (ADR-65 e).
    public static void ApplyFound(CameraCapabilityBinding binding, IReadOnlyList<EnumeratedStream> found, DateTimeOffset at)
    {
        if (found.Count == 0) return;

        if (binding.StreamsFoundAt is null) AddFound(binding, binding.Protocol, found, at);

        foreach (var stream in binding.Streams)
        {
            // A size is only adopted for the address it describes: vendors alias their streams (ADR-38).
            var match = found.FirstOrDefault(entry => PathsMatch(stream.Path, entry.Path));
            if (match is null) continue;

            stream.Width = match.Width;
            stream.Height = match.Height;
            stream.Fps = match.Fps;
            stream.UpdatedAt = at;
        }
    }

    public static StreamChange SetRole(CameraCapabilityBinding binding, CameraStream stream, StreamRole role)
    {
        if (stream.Records && !role.Records()) return StreamChange.StreamRecords;

        TakeRoles(binding, stream, role);
        stream.Role = role;
        stream.UpdatedAt = DateTimeOffset.UtcNow;
        return StreamChange.Done;
    }

    public static StreamChange Remove(CameraCapabilityBinding binding, CameraStream stream)
    {
        if (stream.Records) return StreamChange.StreamRecords;

        binding.Streams.Remove(stream);
        return StreamChange.Done;
    }

    // What the camera serves over a protocol, ranked in the order found, each with the line it already is (ADR-65 e).
    public static IReadOnlyList<StreamOffer> Offer(CameraCapabilityBinding? binding, SupportedProtocol protocol, IReadOnlyList<EnumeratedStream> found)
        => [.. found.Select((entry, rank) => new StreamOffer(rank, entry.Path, entry.Width, entry.Height, entry.Fps,
            binding?.Streams.FirstOrDefault(stream => stream.Protocol == protocol && PathsMatch(stream.Path, entry.Path))?.Id))];

    // A stream added by the user, at the next free rank; its role is taken from whichever stream had it.
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

    private static void AddFound(CameraCapabilityBinding binding, SupportedProtocol protocol, IReadOnlyList<EnumeratedStream> found, DateTimeOffset at)
    {
        // Only a lineup still as its layout left it takes the defaults: the user's choices are never redone.
        var untouched = binding.Streams.Count == 0
                        || (binding.Streams.Count == 1 && binding.Streams.Single().Role == StreamRole.RecordAndDetect);
        var next = binding.Streams.Count == 0 ? 0 : binding.Streams.Max(entry => entry.Ordinal) + 1;

        foreach (var entry in found)
        {
            if (binding.Streams.Any(stream => PathsMatch(stream.Path, entry.Path))) continue;

            binding.Streams.Add(new CameraStream
            {
                BindingId = binding.Id,
                Ordinal = next++,
                Protocol = protocol,
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
