namespace Vyzio.Core.Entities;

// A saved PTZ position, native (token set) or kept by Vyzio (motion time set), in one of four slots (ADR-25, ADR-60).
public sealed class PtzPreset
{
    public const int SurveillanceSlot = 1;
    public const int ParkingSlot = 2;

    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string CameraId { get; set; } = string.Empty;
    public int PresetId { get; set; }
    public string Label { get; set; } = string.Empty;
    public bool Native { get; set; }
    public string? NativeToken { get; set; }
    // Milliseconds of motion right, then down, from the up-left limit (ADR-60).
    public int? PanMs { get; set; }
    public int? TiltMs { get; set; }

    public static string DefaultLabel(int presetId) => presetId switch
    {
        SurveillanceSlot => "Surveillance",
        ParkingSlot => "Parking",
        _ => $"Position {presetId}",
    };
}
