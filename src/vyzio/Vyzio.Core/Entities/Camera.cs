using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json;
using Vyzio.Core.Common;

namespace Vyzio.Core.Entities;

[Table("cameras")]
public class Camera
{
    [Key]
    public string Id { get; set; } = Guid.NewGuid().ToString("N");

    [Required, MaxLength(100)]
    public required string Slug { get; set; }

    [Required, MaxLength(200)]
    public required string DisplayName { get; set; }

    [Required, MaxLength(50)]
    public string SourceType { get; set; } = "rtsp_manual";

    [Required, MaxLength(200)]
    public required string Host { get; set; }

    public int Port { get; set; }

    [MaxLength(200)]
    public string? Username { get; set; }

    [MaxLength(500)]
    public string? Password { get; set; }

    public StreamProtocol StreamProtocol { get; set; } = StreamProtocol.Rtsp;

    // Video access points of this camera — qualities of ONE scene (ADR-38).
    public ICollection<CameraStream> Streams { get; set; } = [];

    // User's pick among Streams for the `detect` role. Null keeps the main stream, so face
    // recognition is never silently degraded by a default (ADR-38).
    [MaxLength(100)]
    public string? DetectStreamId { get; set; }

    // Groups the cameras that share one physical device — the lenses of a multi-sensor box are
    // separate cameras (ADR-38), and this is what lets the UI say so. Null for a single-lens device.
    [MaxLength(200)]
    public string? DeviceId { get; set; }

    public VendorFamily? VendorFamily { get; set; }

    // JSON array of active detection labels e.g. ["person","dog"]. Null defaults to ["person"].
    [MaxLength(500)]
    public string? DetectionLabelsJson { get; set; }

    // JSON array of detected network protocols e.g. ["onvif","v380"]. Populated by probe pipeline.
    public string? SupportedProtocolsJson { get; set; }

    // Per-camera retention overrides (ADR-39). Null means "follow the installation" — never a
    // disguised value, which is why these are nullable rather than defaulted. Zero is a real
    // answer and means "keep nothing of this kind for this camera".
    //
    // These replace the former ContinuousRecordingEnabled boolean: a flag next to a duration would
    // be two sources of truth for one fact. Continuous recording is on exactly when its effective
    // duration exceeds zero.
    public int? ContinuousDaysOverride { get; set; }

    public int? MotionDaysOverride { get; set; }

    public int? EventClipDaysOverride { get; set; }

    // Motion sensitivity auto-tuning (ADR-35). The level is owned by the tuning loop unless the
    // user pins it, in which case the loop skips this camera entirely.
    public MotionSensitivity MotionSensitivity { get; set; } = MotionSensitivity.High;

    public bool MotionSensitivityPinned { get; set; }

    [Required, MaxLength(50)]
    public string Status { get; set; } = "needs_attention";

    public DateTimeOffset? LastReachabilityCheckAt { get; set; }

    public DateTimeOffset? LastSuccessfulFrameAt { get; set; }

    [MaxLength(200)]
    public string? FrigateCameraName { get; set; }

    [NotMapped]
    public string FrigateName => CameraNaming.ToFrigateName(FrigateCameraName, Slug);

    [Required, MaxLength(50)]
    public string ValidationState { get; set; } = "draft";

    public bool IsEnabled { get; set; }

    public bool PrivacyModeActive { get; set; }

    public PrivacyModeSource? PrivacyModeSource { get; set; }

    // true if the vendor API confirmed the hardware-level cut during last toggle
    public bool PrivacyVendorCut { get; set; }

    // PTZ + privacy strategy (ADR-21)
    public bool PtzSupported { get; set; }

    // App-level privacy configuration (ADR-24)
    public PrivacyStrategy PrivacyStrategy { get; set; } = PrivacyStrategy.SoftwareBlur;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    // Rank 0 — the most detailed stream. Recording always uses it, and it is the fallback for
    // everything else.
    [NotMapped]
    public CameraStream? MainStream
        => Streams.OrderBy(stream => stream.Ordinal).FirstOrDefault();

    // The stream carrying the `detect` role. Without an explicit choice the lightest stream wins:
    // Frigate downscales to its own detect size anyway, so analysing a high-definition stream buys
    // nothing and costs decoding on every camera (ADR-38). Falls back to the main stream when it is
    // the only one, or when a stored choice no longer resolves.
    [NotMapped]
    public CameraStream? DetectStream
        => (DetectStreamId is null ? null : Streams.FirstOrDefault(stream => stream.Id == DetectStreamId))
           ?? Streams.OrderByDescending(stream => stream.Ordinal).FirstOrDefault();

    // Projection of the main stream's path — the connection-level view of a camera, on the same
    // footing as Host and Port. Settable at construction because that is when onboarding knows it;
    // afterwards a path belongs to a stream and moves through SetMainStreamPath.
    [NotMapped]
    public string? StreamPath
    {
        get => MainStream?.Path;
        init => SetMainStreamPath(value);
    }

    // Creates or updates the main stream in place. The only supported way to set a camera's primary
    // path: writing StreamPath directly is impossible by construction.
    public void SetMainStreamPath(string? path)
    {
        var main = Streams.FirstOrDefault(stream => stream.Ordinal == 0);
        if (main is null)
        {
            Streams.Add(new CameraStream { CameraId = Id, Ordinal = 0, Path = path });
            return;
        }

        if (main.Path == path) return;

        main.Path = path;
        main.UpdatedAt = DateTimeOffset.UtcNow;
    }

    public IReadOnlyList<string> GetDetectionLabels()
    {
        if (DetectionLabelsJson is null)
            return DefaultLabels;

        try
        {
            return JsonSerializer.Deserialize<List<string>>(DetectionLabelsJson) ?? [.. DefaultLabels];
        }
        catch (JsonException)
        {
            return DefaultLabels;
        }
    }

    public IReadOnlyList<SupportedProtocol> GetSupportedProtocols()
    {
        if (SupportedProtocolsJson is null)
            return [];

        try
        {
            var strings = JsonSerializer.Deserialize<List<string>>(SupportedProtocolsJson) ?? [];
            return strings
                .Select(s => SnakeCaseEnum.TryFromSnakeCase<SupportedProtocol>(s, out var p) ? (SupportedProtocol?)p : null)
                .Where(p => p.HasValue)
                .Select(p => p!.Value)
                .ToList();
        }
        catch (JsonException)
        {
            return [];
        }
    }

    public void AddSupportedProtocol(SupportedProtocol protocol)
    {
        var current = GetSupportedProtocols().ToList();
        if (!current.Contains(protocol))
        {
            current.Add(protocol);
            SupportedProtocolsJson = JsonSerializer.Serialize(current.Select(p => SnakeCaseEnum.ToSnakeCase(p)));
        }
    }

    private static readonly IReadOnlyList<string> DefaultLabels = ["person"];
}
