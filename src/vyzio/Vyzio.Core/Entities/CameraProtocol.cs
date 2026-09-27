using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Vyzio.Core.Entities;

// A protocol the camera speaks: how to reach it and whether it answers, one row per camera and protocol (ADR-61).
[Table("camera_protocols")]
public class CameraProtocol
{
    [Key]
    public string Id { get; set; } = Guid.NewGuid().ToString("N");

    [Required]
    public required string CameraId { get; set; }

    public Camera? Camera { get; set; }

    public SupportedProtocol Protocol { get; set; }

    // Null means the protocol's usual port; for ONVIF, the port is asked of the camera (ADR-56).
    public int? Port { get; set; }

    // Where the camera answers this protocol, asked of the device: the ONVIF device service (ADR-56).
    [MaxLength(500)]
    public string? Endpoint { get; set; }

    // The number this protocol addresses the device by (V380), found by discovery or typed by the user.
    public uint? DeviceId { get; set; }

    // An account of the protocol's own, overriding the camera's for this protocol alone (a Tapo cloud account for KLAP).
    [MaxLength(200)]
    public string? Username { get; set; }

    [MaxLength(500)]
    public string? Password { get; set; }

    // Null until the camera was asked: reach, then login with this protocol's account (ADR-61).
    public ProtocolStatus? Status { get; set; }

    public DateTimeOffset? CheckedAt { get; set; }

    [MaxLength(1000)]
    public string? LastError { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    [NotMapped]
    public int? EffectivePort => Port ?? ProtocolPorts.Usual(Protocol);

    [NotMapped]
    public bool HasSpecificAccount => !string.IsNullOrWhiteSpace(Username);

    [NotMapped]
    public bool Answers => Status == ProtocolStatus.Answers;

    // What the user or discovery entered: a row holding it is never dropped as a failed try (ADR-61).
    [NotMapped]
    public bool HoldsUserData => Port is not null || HasSpecificAccount || DeviceId is not null;
}

// The account a client presents to one protocol of a camera (ADR-61).
public sealed record CameraCredentials(string? Username, string? Password);

// The single home of each protocol's usual port; ONVIF has none, its address is asked of the camera (ADR-56).
public static class ProtocolPorts
{
    public static int? Usual(SupportedProtocol protocol) => protocol switch
    {
        SupportedProtocol.Rtsp => 554,
        SupportedProtocol.Dvrip => 34567,
        SupportedProtocol.V380 => 8800,
        SupportedProtocol.TapoKlap => 80,
        SupportedProtocol.Onvif => null,
        _ => throw new ArgumentOutOfRangeException(nameof(protocol), protocol, null),
    };
}
