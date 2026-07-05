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
// The V380 deviceId (required for auth) is obtained by UDP discovery at probe time and then
// persisted in binding.ConfigJson as {"device_id": <uint>}. Subsequent PTZ commands read from
// ConfigJson, so UDP discovery is not needed again — this makes Docker bridge mode work.
// To bypass discovery entirely, set ConfigJson manually via PUT /cameras/{id}/capabilities/ptz.
internal sealed class V380PtzProvider(V380Client client, ILogger<V380PtzProvider> logger) : IPtzCapabilityProvider
{
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

    public CapabilityProtocol Protocol => CapabilityProtocol.V380;

    public async Task<bool> ProbeAsync(Camera camera, CameraCapabilityBinding binding, CancellationToken ct = default)
    {
        // Pre-load from ConfigJson — allows re-probe without UDP discovery.
        if (TryReadDeviceId(binding.ConfigJson, out var storedId))
            client.PreloadDeviceId(camera.Host, storedId);

        var success = await client.ProbeAsync(camera, ct);

        // Persist the discovered deviceId so future PTZ commands work without UDP discovery.
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
    public async Task PtzStepAsync(Camera camera, CameraCapabilityBinding binding, PtzDirection direction, int speed, CancellationToken ct = default)
    {
        // Pre-load deviceId from persisted ConfigJson — avoids UDP discovery on every command.
        if (TryReadDeviceId(binding.ConfigJson, out var storedId))
            client.PreloadDeviceId(camera.Host, storedId);

        try
        {
            await client.SendStreamCommandAsync(camera, DirectionToPacket(direction).ToArray(), ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "V380 PTZ step failed for {Camera}.", camera.DisplayName);
        }
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
