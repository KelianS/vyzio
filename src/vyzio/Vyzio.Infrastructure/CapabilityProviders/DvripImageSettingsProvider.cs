using System.Text.Json.Nodes;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.VendorAdapters;

namespace Vyzio.Infrastructure.CapabilityProviders;

// IImageSettingsCapabilityProvider for the DVRIP protocol (ADR-29) — Xiongmai/XMEye cameras
// (ICSee, Annke, Sannce, Zosi...). Only Brightness/Contrast/Saturation are confirmed writable,
// via the "AVEnc.VideoColor.[0]" config block (ConfigGet/ConfigSet, cmd 1042/1044) — validated
// against real hardware, see docs/investigations/icsee_dvrip_privacy.md.
//
// Sharpness and IrCutMode are NOT part of this config block on the tested firmware and have not
// been investigated — never guessed. GetImageSettingsAsync reports fixed neutral values for
// them (Sharpness=50, IrCutMode=Auto) and SetImageSettingsAsync silently ignores changes to
// those two fields rather than sending an undocumented command to real hardware.
//
// The exact JSON shape of VideoColor (flat vs. nested under a "Level" schedule array) isn't
// confirmed either — so reads/writes search the whole response tree for the known field names
// instead of assuming a fixed structure (round-trip: get the full node, mutate matching leaves,
// send the *same* node back — every other field the camera returned is preserved untouched).
internal sealed class DvripImageSettingsProvider(DvripClient dvrip) : IImageSettingsCapabilityProvider
{
    private const string VideoColorConfigName = "AVEnc.VideoColor.[0]";

    public SupportedProtocol Protocol => SupportedProtocol.Dvrip;

    public async Task<bool> ProbeAsync(Camera camera, CameraCapabilityBinding binding, CancellationToken ct = default)
    {
        var config = await dvrip.ConfigGetAsync(camera, VideoColorConfigName, ct);
        return FindIntProperty(config, "Brightness") is not null;
    }

    public async Task<CameraImageSettings?> GetImageSettingsAsync(Camera camera, CameraCapabilityBinding binding, CancellationToken ct = default)
    {
        var config = await dvrip.ConfigGetAsync(camera, VideoColorConfigName, ct);

        var brightness = FindIntProperty(config, "Brightness");
        if (brightness is null)
            throw new DvripCallException($"La caméra {camera.Host} n'a pas retourné de champ Brightness dans '{VideoColorConfigName}'.");

        return new CameraImageSettings(
            brightness.Value,
            FindIntProperty(config, "Contrast") ?? 50,
            FindIntProperty(config, "Saturation") ?? 50,
            Sharpness: 50, // Not part of this config block on tested firmware — never guessed.
            IrCutMode.Auto); // Day/night mode not investigated for DVRIP — never guessed.
    }

    public async Task SetImageSettingsAsync(Camera camera, CameraCapabilityBinding binding, CameraImageSettings settings, CancellationToken ct = default)
    {
        var config = await dvrip.ConfigGetAsync(camera, VideoColorConfigName, ct);
        if (config is null)
            throw new DvripCallException($"Impossible de relire '{VideoColorConfigName}' avant écriture sur {camera.Host}.");

        SetIntProperty(config, "Brightness", settings.Brightness);
        SetIntProperty(config, "Contrast", settings.Contrast);
        SetIntProperty(config, "Saturation", settings.Saturation);
        // Sharpness/IrCutMode intentionally not written — see class remarks.

        await dvrip.ConfigSetAsync(camera, VideoColorConfigName, config, ct);
    }

    // internal (not private): unit-tested directly against synthetic JSON trees — the real
    // camera's VideoColor schema (flat vs. nested under "Level") isn't confirmed, so this
    // traversal logic is the part most worth locking down with tests.
    internal static int? FindIntProperty(JsonNode? node, string propertyName)
    {
        switch (node)
        {
            case JsonObject obj:
                if (obj.TryGetPropertyValue(propertyName, out var value) && value is JsonValue leaf && leaf.TryGetValue<int>(out var i))
                    return i;
                foreach (var (_, child) in obj)
                {
                    var found = FindIntProperty(child, propertyName);
                    if (found is not null) return found;
                }
                return null;
            case JsonArray arr:
                foreach (var child in arr)
                {
                    var found = FindIntProperty(child, propertyName);
                    if (found is not null) return found;
                }
                return null;
            default:
                return null;
        }
    }

    // Overwrites every occurrence of propertyName found anywhere in the tree (a schedule config
    // may have multiple time-based entries — Vyzio doesn't expose per-schedule granularity, so
    // the same value is applied uniformly).
    internal static bool SetIntProperty(JsonNode? node, string propertyName, int value)
    {
        var found = false;
        switch (node)
        {
            case JsonObject obj:
                if (obj.ContainsKey(propertyName))
                {
                    obj[propertyName] = value;
                    found = true;
                }
                foreach (var (_, child) in obj.ToList())
                {
                    if (SetIntProperty(child, propertyName, value)) found = true;
                }
                break;
            case JsonArray arr:
                foreach (var child in arr)
                {
                    if (SetIntProperty(child, propertyName, value)) found = true;
                }
                break;
        }
        return found;
    }
}
