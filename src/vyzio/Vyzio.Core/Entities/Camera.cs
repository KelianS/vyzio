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

    [MaxLength(500)]
    public string? StreamPath { get; set; }

    public StreamProtocol StreamProtocol { get; set; } = StreamProtocol.Rtsp;

    public VendorFamily? VendorFamily { get; set; }

    // JSON array of active detection labels e.g. ["person","dog"]. Null defaults to ["person"].
    [MaxLength(500)]
    public string? DetectionLabelsJson { get; set; }

    // JSON array of detected network protocols e.g. ["onvif","v380"]. Populated by probe pipeline.
    public string? SupportedProtocolsJson { get; set; }

    public bool ContinuousRecordingEnabled { get; set; }

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

    [Required, MaxLength(50)]
    public string ValidationState { get; set; } = "draft";

    public bool IsEnabled { get; set; }

    public bool PrivacyModeActive { get; set; }

    public PrivacyModeSource? PrivacyModeSource { get; set; }

    // true if the vendor API confirmed the hardware-level cut during last toggle
    public bool PrivacyVendorCut { get; set; }

    // PTZ + privacy strategy (ADR-21)
    public bool PtzSupported { get; set; }

    // App-level privacy configuration. Column kept as privacy_mode_strategy for schema compat.
    [Column("privacy_mode_strategy")]
    public PrivacyStrategy PrivacyStrategy { get; set; } = PrivacyStrategy.SoftwareBlur;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

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
