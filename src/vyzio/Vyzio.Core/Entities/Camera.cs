using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json;

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

    // The camera's account; a protocol may carry its own, resolved by CredentialsFor (ADR-61).
    [MaxLength(200)]
    public string? Username { get; set; }

    [MaxLength(500)]
    public string? Password { get; set; }

    // The protocols this camera speaks, how to reach each and whether it answers (ADR-61).
    public ICollection<CameraProtocol> Protocols { get; set; } = [];

    // What the camera does, the video stream included, each over one protocol (ADR-22, ADR-61).
    public ICollection<CameraCapabilityBinding> Capabilities { get; set; } = [];

    // Groups the cameras that share one physical device — the lenses of a multi-sensor box are
    // separate cameras (ADR-38), and this is what lets the UI say so. Null for a single-lens device.
    [MaxLength(200)]
    public string? DeviceId { get; set; }

    // JSON array of active detection labels e.g. ["person","dog"]. Null defaults to ["person"].
    [MaxLength(500)]
    public string? DetectionLabelsJson { get; set; }

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

    // When detection last ran; null tells the page to run it on arrival (ADR-68 b).
    public DateTimeOffset? DetectedAt { get; set; }

    // The key this camera answers to in Frigate. Set at onboarding and on every rename, never null:
    // Frigate keys refuse dashes, so it is never the slug itself.
    [Required, MaxLength(200)]
    public required string FrigateCameraName { get; set; }

    public CameraValidationState ValidationState { get; set; } = CameraValidationState.Draft;

    public bool IsEnabled { get; set; }

    public bool PrivacyModeActive { get; set; }

    public PrivacyModeSource? PrivacyModeSource { get; set; }

    // true if the vendor API confirmed the hardware-level cut during last toggle
    public bool PrivacyVendorCut { get; set; }

    // Null when the camera did what the last toggle asked, or was asked nothing (SPECS 9.2)
    public PrivacyMiss? PrivacyMiss { get; set; }

    // What support reads under the sentence when the camera did not follow, never a secret (SPECS 1.5)
    [MaxLength(PrivacyMissDetailLength)]
    public string? PrivacyMissDetail { get; set; }

    public const int PrivacyMissDetailLength = 500;

    // PTZ + privacy strategy (ADR-21)
    public bool PtzSupported { get; set; }

    // App-level privacy configuration (ADR-24)
    public PrivacyStrategy PrivacyStrategy { get; set; } = PrivacyStrategy.SoftwareBlur;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    // The qualities of ONE scene (ADR-38), rows under the stream binding (ADR-65); none without a binding.
    [NotMapped]
    public IReadOnlyCollection<CameraStream> Streams
        => StreamBinding?.Streams.OrderBy(stream => stream.Ordinal).ToList() ?? [];

    // The stream holding the record role; StreamLineup keeps exactly one (ADR-65).
    [NotMapped]
    public CameraStream? RecordStream => Streams.FirstOrDefault(stream => stream.Records);

    // The stream holding the detect role, else the recording stream (ADR-65 c).
    [NotMapped]
    public CameraStream? DetectStream => Streams.FirstOrDefault(stream => stream.Detects) ?? RecordStream;

    // What Frigate is handed: an enabled camera in surveillance whose stream has a protocol (ADR-61, ADR-68 d).
    [NotMapped]
    public bool InSurveillance
        => IsEnabled && ValidationState == CameraValidationState.Validated && StreamBinding is not null;

    // At most two streams, so watching never opens a third connection: the role streams, plus a verified one when the roles share a stream (ADR-72 c).
    [NotMapped]
    public IReadOnlyList<CameraStream> LiveStreams
    {
        get
        {
            var roles = Streams.Where(stream => stream.Records || stream.Detects).Take(2).ToList();
            var candidates = roles.Count > 1 ? roles
                : roles.Concat(Streams.Where(stream => stream.Verified && !roles.Contains(stream)).Take(1)).ToList();
            return candidates.All(stream => stream.HasKnownResolution)
                ? candidates.OrderBy(stream => (long)stream.Width!.Value * stream.Height!.Value).ToList()
                : candidates.OrderByDescending(stream => stream.Ordinal).ToList();
        }
    }

    [NotMapped]
    public IReadOnlyList<LiveQuality> LiveQualities
        => !InSurveillance ? [] : LiveStreams.Count > 1 ? [LiveQuality.Low, LiveQuality.High] : [LiveQuality.Low];

    // Low is the smaller of the live streams, High the larger; null for a binding whose streams were never laid out.
    public CameraStream? LiveStream(LiveQuality quality)
    {
        var live = LiveStreams;
        if (live.Count == 0) return null;
        return quality == LiveQuality.High ? live[^1] : live[0];
    }

    [NotMapped]
    public bool DetectsOnRecordingStream => RecordStream is not null && !Streams.Any(stream => stream.Detects);

    // The video stream capability; null until its protocol is chosen, never a disguised default (ADR-61).
    [NotMapped]
    public CameraCapabilityBinding? StreamBinding
        => Capabilities.FirstOrDefault(binding => binding.Capability == CameraCapability.Stream);

    // A protocol a capability or a stream goes through is never removed (ADR-61 d, ADR-65 a).
    public bool GoesThrough(SupportedProtocol protocol)
        => Capabilities.Any(binding => binding.Protocol == protocol) || Streams.Any(stream => stream.Protocol == protocol);

    public CameraProtocol? Protocol(SupportedProtocol protocol)
        => Protocols.FirstOrDefault(entry => entry.Protocol == protocol);

    public CameraProtocol EnsureProtocol(SupportedProtocol protocol)
    {
        if (Protocol(protocol) is { } existing) return existing;

        var created = new CameraProtocol { CameraId = Id, Protocol = protocol };
        Protocols.Add(created);
        return created;
    }

    // The port a client dials for a protocol with a usual port; ONVIF asks the camera instead (ADR-56).
    public int PortOf(SupportedProtocol protocol)
        => Protocol(protocol)?.EffectivePort
           ?? ProtocolPorts.Usual(protocol)
           ?? throw new InvalidOperationException($"{protocol} has no usual port: its address is asked of the camera.");

    // The protocol's specific account when it has one, the camera's otherwise; no client reads Username itself (ADR-61).
    public CameraCredentials CredentialsFor(SupportedProtocol protocol)
        => Protocol(protocol) is { HasSpecificAccount: true } specific
            ? new CameraCredentials(specific.Username, specific.Password)
            : new CameraCredentials(Username, Password);

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

    public string? GetProtocolEndpoint(SupportedProtocol protocol) => Protocol(protocol)?.Endpoint;

    public void SetProtocolEndpoint(SupportedProtocol protocol, string endpoint)
        => EnsureProtocol(protocol).Endpoint = endpoint;

    // Only through CameraEndpointForgetting, which clears the in-memory cache in the same gesture (ADR-56).
    public void ClearProtocolEndpoints()
    {
        foreach (var entry in Protocols) entry.Endpoint = null;
    }

    private static readonly IReadOnlyList<string> DefaultLabels = ["person"];
}
