using System.Text.Json.Nodes;
using Microsoft.Extensions.Logging;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.VendorAdapters;

namespace Vyzio.Infrastructure.Services;

// Asks a camera what it actually serves (ADR-38), over whichever protocol can answer. Never throws:
// every failure path returns an empty list, which callers read as "keep the stream we already have".
internal sealed class CameraStreamEnumerator(
    OnvifClient onvifClient,
    DvripClient dvripClient,
    ILogger<CameraStreamEnumerator> logger) : ICameraStreamEnumerator
{
    // XMEye extra-stream selector, verified on real hardware (see the CPU profiling investigation).
    private const string DvripSubStreamQuery = "?channel=0&subtype=1";

    public async Task<IReadOnlyList<EnumeratedScene>> EnumerateAsync(Camera camera, CancellationToken ct = default)
    {
        try
        {
            // The transport decides how a stream is addressed, so it decides how streams are
            // enumerated: a DVRIP camera reaches Frigate through go2rtc and selects its sub-stream by
            // query, so an RTSP path advertised over ONVIF would be meaningless for it.
            //
            // Deliberately NOT gated on Camera.SupportedProtocols: that list is filled by the
            // discovery pipeline and is empty on every manually added camera, so gating on it would
            // leave those cameras without any enumeration at all. Asking ONVIF costs one HTTP call
            // that fails fast when the service is absent, and an empty result is already the
            // "nothing to report" answer.
            return camera.StreamProtocol == StreamProtocol.Dvrip
                ? await EnumerateOverDvripAsync(camera, ct)
                : await EnumerateOverOnvifAsync(camera, ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Stream enumeration failed for {Camera}.", camera.DisplayName);
            return [];
        }
    }

    private async Task<IReadOnlyList<EnumeratedScene>> EnumerateOverOnvifAsync(Camera camera, CancellationToken ct)
    {
        var profiles = await onvifClient.GetMediaProfilesAsync(camera, ct);
        if (profiles.Count == 0) return [];

        var scenes = new List<EnumeratedScene>();

        // Profiles sharing a video source describe one scene; a source token we never got is treated
        // as its own scene rather than merged, so an unlabelled profile can never silently pull a
        // second lens into the wrong camera.
        var groups = profiles.GroupBy(profile => profile.SourceToken ?? profile.Token);

        foreach (var group in groups)
        {
            var streams = new List<EnumeratedStream>();

            // Most detailed first — the resulting order is the rank Vyzio persists, and rank 0 is
            // what recording uses. A camera may serve any number of them.
            var ordered = group
                .OrderByDescending(profile => (long)(profile.Width ?? 0) * (profile.Height ?? 0))
                .ToList();

            foreach (var profile in ordered)
            {
                var uri = await onvifClient.GetStreamUriAsync(camera, profile.Token, ct);
                var path = ToStreamPath(uri);
                if (path is null) continue;

                streams.Add(new EnumeratedStream(path, profile.Width, profile.Height, profile.Fps));
            }

            if (streams.Count > 0)
                scenes.Add(new EnumeratedScene(group.Key, streams));
        }

        return scenes;
    }

    // DVRIP reports its encoder setup as MainFormat/ExtraFormat. ExtraFormat.VideoEnable is what
    // proves the sub-stream exists and is active — the sub is never offered on convention alone.
    // Resolutions are deliberately dropped: the camera reports nominal labels ("3M", "D1") that do
    // not match the real pixel dimensions, and a wrong size would reintroduce upscaling (ADR-38).
    private async Task<IReadOnlyList<EnumeratedScene>> EnumerateOverDvripAsync(Camera camera, CancellationToken ct)
    {
        JsonNode? encode;
        try
        {
            encode = await dvripClient.ConfigGetAsync(camera, "Simplify.Encode", ct);
        }
        catch (DvripCallException ex)
        {
            logger.LogDebug("DVRIP stream enumeration unavailable for {Camera}: {Reason}", camera.DisplayName, ex.Message);
            return [];
        }

        var channel = encode is JsonArray { Count: > 0 } array ? array[0] : encode;
        if (channel is null) return [];

        var streams = new List<EnumeratedStream> { new(null, null, null, ReadFps(channel["MainFormat"])) };

        if (channel["ExtraFormat"]?["VideoEnable"]?.GetValue<bool>() == true)
        {
            streams.Add(new EnumeratedStream(DvripSubStreamQuery, null, null, ReadFps(channel["ExtraFormat"])));
        }

        return [new EnumeratedScene(camera.Id, streams)];
    }

    private static int? ReadFps(JsonNode? format)
    {
        try
        {
            var fps = format?["Video"]?["FPS"]?.GetValue<int>();
            return fps > 0 ? fps : null;
        }
        catch
        {
            return null;
        }
    }

    // Vyzio composes RTSP URLs from the camera's own host, port and credentials, so only the path
    // portion of what ONVIF returns is kept. A camera advertising a different host is ignored rather
    // than trusted: on a NAT'd or multi-homed network its idea of its own address is often wrong.
    private static string? ToStreamPath(string? uri)
    {
        if (string.IsNullOrWhiteSpace(uri)) return null;
        if (!Uri.TryCreate(uri, UriKind.Absolute, out var parsed)) return null;

        var path = parsed.PathAndQuery;
        return string.IsNullOrWhiteSpace(path) || path == "/" ? null : path;
    }
}
