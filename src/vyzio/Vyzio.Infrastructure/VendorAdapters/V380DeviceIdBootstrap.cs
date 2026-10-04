using System.Buffers.Binary;
using Vyzio.Core.Entities;

namespace Vyzio.Infrastructure.VendorAdapters;

// The V380 device id, in one place for every V380 caller: the V380 row, then the ONVIF serial, then UDP discovery (ADR-61).
internal static class V380DeviceIdBootstrap
{
    // The row first, then the ONVIF serial (bytes 2..5, big-endian); UDP discovery stays with V380Client.
    public static async Task PreloadAsync(Camera camera, V380Client client, OnvifClient onvif, CancellationToken ct)
    {
        PreloadStored(camera, client);

        if (client.GetCachedDeviceId(camera.Host) is null)
        {
            var onvifId = await TryGetDeviceIdViaOnvifSerialAsync(camera, onvif, ct);
            if (onvifId.HasValue)
                client.PreloadDeviceId(camera.Host, onvifId.Value);
        }
    }

    // The number the user typed or a probe found wins over what the client remembers of the host.
    public static void PreloadStored(Camera camera, V380Client client)
    {
        if (camera.Protocol(SupportedProtocol.V380)?.DeviceId is { } storedId)
            client.PreloadDeviceId(camera.Host, storedId);
    }

    // Call after a successful probe so future commands work without re-discovery; the use case saves the camera.
    public static void PersistIfDiscovered(Camera camera, V380Client client)
    {
        var discoveredId = client.GetCachedDeviceId(camera.Host);
        if (discoveredId.HasValue)
            camera.EnsureProtocol(SupportedProtocol.V380).DeviceId = discoveredId.Value;
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
