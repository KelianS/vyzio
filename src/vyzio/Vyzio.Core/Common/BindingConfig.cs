using System.Text.Json;
using System.Text.Json.Nodes;

namespace Vyzio.Core.Common;

// One reader and writer for the keys a capability binding keeps in its ConfigJson (ADR-22).
public static class BindingConfig
{
    public const string PanInverted = "pan_inverted";
    public const string DeviceId = "device_id";

    public static bool ReadBool(string? configJson, string key)
    {
        if (string.IsNullOrEmpty(configJson)) return false;
        try
        {
            return JsonNode.Parse(configJson)?[key]?.GetValue<bool>() ?? false;
        }
        catch (Exception ex) when (ex is JsonException or InvalidOperationException or FormatException)
        {
            return false;
        }
    }

    // Sets one key and keeps the others; a config that cannot be read raises rather than being dropped.
    public static string With(string? configJson, string key, JsonNode? value)
    {
        var config = (string.IsNullOrEmpty(configJson) ? null : JsonNode.Parse(configJson) as JsonObject) ?? [];
        config[key] = value;
        return config.ToJsonString();
    }

    // A setting the user owns survives a new config that does not name it.
    public static string? Carry(string? from, string? into, string key)
    {
        if (!ReadBool(from, key) || ReadBool(into, key)) return into;
        return With(into, key, true);
    }
}
