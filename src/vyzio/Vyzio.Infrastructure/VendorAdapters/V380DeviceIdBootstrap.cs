using System.Buffers.Binary;
using System.Text.Json;
using Vyzio.Core.Entities;

namespace Vyzio.Infrastructure.VendorAdapters;

// Shared V380 device-ID bootstrap (persisted ConfigJson → ONVIF serial → UDP discovery),
// used by every V380 capability provider (PTZ, image settings...) so the resolution order
// and ONVIF-serial decoding logic live in exactly one place (CLAUDE.md zero-duplication rule).
internal static class V380DeviceIdBootstrap
{
    // Pre-loads the client's device-ID cache for this host: from the binding's persisted
    // ConfigJson if present, otherwise via ONVIF GetDeviceInformation serial bytes[2..5] BE
    // (confirmed: serial "9609019b8ae5" → 0x019B8AE5 = 26970853). Leaves UDP discovery to
    // V380Client.ProbeAsync/SendStreamCommandAsync, which fall back to it automatically.
    public static async Task PreloadAsync(Camera camera, CameraCapabilityBinding binding, V380Client client, OnvifClient onvif, CancellationToken ct)
    {
        if (TryReadDeviceId(binding.ConfigJson, out var storedId))
            client.PreloadDeviceId(camera.Host, storedId);

        if (client.GetCachedDeviceId(camera.Host) is null)
        {
            var onvifId = await TryGetDeviceIdViaOnvifSerialAsync(camera, onvif, ct);
            if (onvifId.HasValue)
                client.PreloadDeviceId(camera.Host, onvifId.Value);
        }
    }

    // Call after a successful probe so future commands work without re-discovery.
    public static void PersistIfDiscovered(CameraCapabilityBinding binding, V380Client client, string host)
    {
        var discoveredId = client.GetCachedDeviceId(host);
        if (discoveredId.HasValue)
            binding.ConfigJson = JsonSerializer.Serialize(new { device_id = discoveredId.Value });
    }

    public static bool TryReadDeviceId(string? configJson, out uint deviceId)
    {
        deviceId = 0;
        if (string.IsNullOrEmpty(configJson)) return false;
        try
        {
            var doc = JsonDocument.Parse(configJson);
            return doc.RootElement.TryGetProperty("device_id", out var prop)
                && prop.TryGetUInt32(out deviceId);
        }
        catch { return false; }
    }

    private static async Task<uint?> TryGetDeviceIdViaOnvifSerialAsync(Camera camera, OnvifClient onvif, CancellationToken ct)
    {
        try
        {
            var info = await onvif.GetDeviceInformationAsync(camera, ct);
            if (info?.SerialNumber is null) return null;

            var bytes = Convert.FromHexString(info.SerialNumber.Trim());
            if (bytes.Length < 6) return null;

            var deviceId = BinaryPrimitives.ReadUInt32BigEndian(bytes.AsSpan(2, 4));
            return deviceId == 0 ? null : deviceId;
        }
        catch { return null; }
    }
}
