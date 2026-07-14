namespace Vyzio.Core.Entities;

// Persisted PTZ position preset (ADR-25).
// preset_id is 1..4 — slots 1 and 2 are reserved (Surveillance, Parking);
// slots 3 and 4 are user-defined.
// Branch A (native): native=true, native_token set, steps_x/y null.
// Branch B (Vyzio-managed): native=false, steps_x/y set, native_token null.
public sealed class PtzPreset
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string CameraId { get; set; } = string.Empty;
    public int PresetId { get; set; }
    public string Label { get; set; } = string.Empty;
    public bool Native { get; set; }
    public string? NativeToken { get; set; }
    public int? StepsX { get; set; }
    public int? StepsY { get; set; }

    public static string DefaultLabel(int presetId) => presetId switch
    {
        1 => "Surveillance",
        2 => "Parking",
        _ => $"Position {presetId}",
    };
}
