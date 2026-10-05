namespace Vyzio.Core.Entities;

// A position Vyzio counts in motion time for a camera that keeps no presets, in one of four slots; the camera holds the native ones (ADR-60, ADR-69).
public sealed class PtzPreset
{
    public const int SurveillanceSlot = 1;
    public const int ParkingSlot = 2;
    // The slots of SPECS 9.3; a camera preset numbered beyond them is ignored (ADR-69 e).
    public const int LastSlot = 4;

    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string CameraId { get; set; } = string.Empty;
    public int PresetId { get; set; }
    public string Label { get; set; } = string.Empty;
    // Milliseconds of motion right, then down, from the up-left limit (ADR-60).
    public int? PanMs { get; set; }
    public int? TiltMs { get; set; }

    public static IEnumerable<int> Slots => Enumerable.Range(SurveillanceSlot, LastSlot - SurveillanceSlot + 1);

    public static bool IsSlot(int presetId) => presetId is >= SurveillanceSlot and <= LastSlot;

    public static string DefaultLabel(int presetId) => presetId switch
    {
        SurveillanceSlot => "Surveillance",
        ParkingSlot => "Parking",
        _ => $"Position {presetId}",
    };
}
