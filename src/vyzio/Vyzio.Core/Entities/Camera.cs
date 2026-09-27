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

    // The stream capability's qualities of ONE scene (ADR-38); keyed by camera, which has one stream binding (ADR-61).
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

    // The video stream capability; null until its protocol is chosen, never a disguised default (ADR-61).
    [NotMapped]
    public CameraCapabilityBinding? StreamBinding
        => Capabilities.FirstOrDefault(binding => binding.Capability == CameraCapability.Stream);

    // Creates or updates the main stream in place: the one way to set the stream capability's main path.
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
