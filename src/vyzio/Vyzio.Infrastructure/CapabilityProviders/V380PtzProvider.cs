using System.Buffers.Binary;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.VendorAdapters;

namespace Vyzio.Infrastructure.CapabilityProviders;

// IPtzCapabilityProvider for the V380 Pro proprietary port-8800 protocol.
// Each step sends one 16-byte PTZ packet on the stream connection (~100ms movement).
// Continuous move is not supported — the protocol requires a persistent stream loop for
// sustained movement, which is not implemented here (step-based PTZ is sufficient, ADR-22).
//
// Device ID bootstrap order (ProbeAsync):
//   1. Persisted ConfigJson {"device_id": ...} — fastest, no network.
//   2. ONVIF GetDeviceInformation serial bytes[2..5] BE — works from Docker bridge (TCP only).
//   3. V380 UDP NVDEVSEARCH — fallback for environments without ONVIF on port 8899.
// After a successful probe, the device ID is persisted back to ConfigJson by the use case layer.
internal sealed class V380PtzProvider(
    V380Client client,
    OnvifClient onvif,
    V380PtzPositionTracker positionTracker,
    ILogger<V380PtzProvider> logger) : IPtzCapabilityProvider
{
    // Number of UpLeft steps to reach the mechanical limit from any position (ADR-25 Branch B).
    private const int HomingSteps = 200;
    // 16-byte PTZ binary packets (opcode 0xAA). Pan/tilt are uint16 LE: neutral=1000.
    // Direction mapping confirmed by physical testing — inverted from prsyahmi/v380 source labels:
    //   pan:  1002 (0x03EA) = RIGHT on screen, 1001 (0x03E9) = LEFT
    //   tilt: 1003 (0x03EB) = UP,              1004 (0x03EC) = DOWN
    private static ReadOnlySpan<byte> Stop      => [0xAA,0x00,0x00,0x00, 0xE8,0x03,0xE8,0x03, 0xE8,0x03,0xE8,0x03, 0x00,0x00,0x01,0x00];
    private static ReadOnlySpan<byte> Right     => [0xAA,0x00,0x00,0x00, 0xE8,0x03,0xE8,0x03, 0xEA,0x03,0xE8,0x03, 0x00,0x00,0x01,0x00];
    private static ReadOnlySpan<byte> Left      => [0xAA,0x00,0x00,0x00, 0xE8,0x03,0xE8,0x03, 0xE9,0x03,0xE8,0x03, 0x00,0x00,0x01,0x00];
    private static ReadOnlySpan<byte> Up        => [0xAA,0x00,0x00,0x00, 0xE8,0x03,0xE8,0x03, 0xE8,0x03,0xEB,0x03, 0x00,0x00,0x01,0x00];
    private static ReadOnlySpan<byte> Down      => [0xAA,0x00,0x00,0x00, 0xE8,0x03,0xE8,0x03, 0xE8,0x03,0xEC,0x03, 0x00,0x00,0x01,0x00];
    private static ReadOnlySpan<byte> UpRight   => [0xAA,0x00,0x00,0x00, 0xE8,0x03,0xE8,0x03, 0xEA,0x03,0xEB,0x03, 0x00,0x00,0x01,0x00];
    private static ReadOnlySpan<byte> UpLeft    => [0xAA,0x00,0x00,0x00, 0xE8,0x03,0xE8,0x03, 0xE9,0x03,0xEB,0x03, 0x00,0x00,0x01,0x00];
    private static ReadOnlySpan<byte> DownRight => [0xAA,0x00,0x00,0x00, 0xE8,0x03,0xE8,0x03, 0xEA,0x03,0xEC,0x03, 0x00,0x00,0x01,0x00];
    private static ReadOnlySpan<byte> DownLeft  => [0xAA,0x00,0x00,0x00, 0xE8,0x03,0xE8,0x03, 0xE9,0x03,0xEC,0x03, 0x00,0x00,0x01,0x00];

    public SupportedProtocol Protocol => SupportedProtocol.V380;

    public async Task<bool> ProbeAsync(Camera camera, CameraCapabilityBinding binding, CancellationToken ct = default)
    {
        // Pre-load from ConfigJson — allows re-probe without discovery.
        if (TryReadDeviceId(binding.ConfigJson, out var storedId))
            client.PreloadDeviceId(camera.Host, storedId);

        // Bootstrap via ONVIF serial if device ID not yet known.
        // ONVIF serial bytes[2..5] BE = V380 device ID.
        // Confirmed: serial "9609019b8ae5" → 0x019B8AE5 = 26970853.
        if (client.GetCachedDeviceId(camera.Host) is null)
        {
            var onvifId = await TryGetDeviceIdViaOnvifSerialAsync(camera, ct);
            if (onvifId.HasValue)
                client.PreloadDeviceId(camera.Host, onvifId.Value);
        }

        var success = await client.ProbeAsync(camera, ct);

        // Persist the discovered deviceId so future PTZ commands work without discovery.
        // (The use case layer calls binding.SaveAsync after ProbeAsync returns.)
        if (success)
        {
            var discoveredId = client.GetCachedDeviceId(camera.Host);
            if (discoveredId.HasValue)
                binding.ConfigJson = JsonSerializer.Serialize(new { device_id = discoveredId.Value });
        }

        return success;
    }

    // Sends a single PTZ step packet (~100ms movement per packet, ~200ms gap for smooth motion).
    // Overrides the default Move+Stop fallback — V380 has no persistent session concept here.
    // Also updates the virtual position tracker for Branch B preset management (ADR-25).
    public async Task PtzStepAsync(Camera camera, CameraCapabilityBinding binding, PtzDirection direction, int speed, CancellationToken ct = default)
    {
        if (TryReadDeviceId(binding.ConfigJson, out var storedId))
            client.PreloadDeviceId(camera.Host, storedId);

        try
        {
            await client.SendStreamCommandAsync(camera, DirectionToPacket(direction).ToArray(), ct);
            // Update virtual position if homing has already established the origin.
            if (positionTracker.Get(camera.Id) is not null)
            {
                var (dx, dy) = DirectionToDelta(direction);
                positionTracker.Update(camera.Id, dx, dy);
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "V380 PTZ step failed for {Camera}.", camera.DisplayName);
        }
    }

    // Branch B (ADR-25): returns the virtual step position from home for this camera.
    public (int StepsX, int StepsY)? GetVirtualPosition(string cameraId)
        => positionTracker.Get(cameraId) is { } pos ? (pos.X, pos.Y) : null;

    // Branch B (ADR-25): sends HomingSteps UpLeft packets to reach mechanical limit, then resets virtual position.
    public async Task PtzHomingStepsAsync(Camera camera, CameraCapabilityBinding binding, CancellationToken ct = default)
    {
        if (TryReadDeviceId(binding.ConfigJson, out var storedId))
            client.PreloadDeviceId(camera.Host, storedId);

        logger.LogInformation("V380 homing started for {Camera} ({Steps} steps UpLeft).", camera.DisplayName, HomingSteps);
        var packet = UpLeft.ToArray();
        for (var i = 0; i < HomingSteps; i++)
        {
            try { await client.SendStreamCommandAsync(camera, packet, ct); }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "V380 homing step {Step}/{Total} failed for {Camera}.", i + 1, HomingSteps, camera.DisplayName);
            }
        }
        positionTracker.Set(camera.Id, 0, 0);
        logger.LogInformation("V380 homing complete for {Camera}. Virtual position reset to (0, 0).", camera.DisplayName);
    }

    // V380 step-based PTZ: each packet causes a bounded micro-movement; there is no
    // continuous move mode without a persistent background stream loop.
    public Task PtzMoveAsync(Camera camera, CameraCapabilityBinding binding, PtzDirection direction, int speed, CancellationToken ct = default)
        => Task.CompletedTask;

    public Task PtzStopAsync(Camera camera, CameraCapabilityBinding binding, CancellationToken ct = default)
        => Task.CompletedTask;

    public Task PtzGoToPresetAsync(Camera camera, CameraCapabilityBinding binding, int presetId, CancellationToken ct = default)
        => Task.CompletedTask;

    public Task PtzSavePresetAsync(Camera camera, CameraCapabilityBinding binding, int presetId, CancellationToken ct = default)
        => Task.CompletedTask;

    private async Task<uint?> TryGetDeviceIdViaOnvifSerialAsync(Camera camera, CancellationToken ct)
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

    private static bool TryReadDeviceId(string? configJson, out uint deviceId)
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

    private static (int dx, int dy) DirectionToDelta(PtzDirection direction) => direction switch
    {
        PtzDirection.Up        => ( 0, -1),
        PtzDirection.Down      => ( 0,  1),
        PtzDirection.Left      => (-1,  0),
        PtzDirection.Right     => ( 1,  0),
        PtzDirection.UpLeft    => (-1, -1),
        PtzDirection.UpRight   => ( 1, -1),
        PtzDirection.DownLeft  => (-1,  1),
        PtzDirection.DownRight => ( 1,  1),
        _                      => ( 0,  0),
    };

    private static ReadOnlySpan<byte> DirectionToPacket(PtzDirection direction) => direction switch
    {
        PtzDirection.Up        => Up,
        PtzDirection.Down      => Down,
        PtzDirection.Left      => Left,
        PtzDirection.Right     => Right,
        PtzDirection.UpLeft    => UpLeft,
        PtzDirection.UpRight   => UpRight,
        PtzDirection.DownLeft  => DownLeft,
        PtzDirection.DownRight => DownRight,
        _                      => Stop,
    };
}
