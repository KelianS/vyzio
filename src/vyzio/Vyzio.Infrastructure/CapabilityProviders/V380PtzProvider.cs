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
    ILogger<V380PtzProvider> logger) : IPtzCapabilityProvider
{
    // 16-byte PTZ binary packets (opcode 0xAA). Pan/tilt are uint16 LE: neutral=1000.
    // Direction mapping confirmed by physical testing — inverted from prsyahmi/v380 source labels:
    //   pan:  1002 (0x03EA) = RIGHT on screen, 1001 (0x03E9) = LEFT
    //   tilt: 1003 (0x03EB) = UP,              1004 (0x03EC) = DOWN
#pragma warning disable format // Aligned as a table so each row reads against the others.
    private static ReadOnlySpan<byte> Stop      => [0xAA,0x00,0x00,0x00, 0xE8,0x03,0xE8,0x03, 0xE8,0x03,0xE8,0x03, 0x00,0x00,0x01,0x00];
    private static ReadOnlySpan<byte> Right     => [0xAA,0x00,0x00,0x00, 0xE8,0x03,0xE8,0x03, 0xEA,0x03,0xE8,0x03, 0x00,0x00,0x01,0x00];
    private static ReadOnlySpan<byte> Left      => [0xAA,0x00,0x00,0x00, 0xE8,0x03,0xE8,0x03, 0xE9,0x03,0xE8,0x03, 0x00,0x00,0x01,0x00];
    private static ReadOnlySpan<byte> Up        => [0xAA,0x00,0x00,0x00, 0xE8,0x03,0xE8,0x03, 0xE8,0x03,0xEB,0x03, 0x00,0x00,0x01,0x00];
    private static ReadOnlySpan<byte> Down      => [0xAA,0x00,0x00,0x00, 0xE8,0x03,0xE8,0x03, 0xE8,0x03,0xEC,0x03, 0x00,0x00,0x01,0x00];
    private static ReadOnlySpan<byte> UpRight   => [0xAA,0x00,0x00,0x00, 0xE8,0x03,0xE8,0x03, 0xEA,0x03,0xEB,0x03, 0x00,0x00,0x01,0x00];
    private static ReadOnlySpan<byte> UpLeft    => [0xAA,0x00,0x00,0x00, 0xE8,0x03,0xE8,0x03, 0xE9,0x03,0xEB,0x03, 0x00,0x00,0x01,0x00];
    private static ReadOnlySpan<byte> DownRight => [0xAA,0x00,0x00,0x00, 0xE8,0x03,0xE8,0x03, 0xEA,0x03,0xEC,0x03, 0x00,0x00,0x01,0x00];
    private static ReadOnlySpan<byte> DownLeft  => [0xAA,0x00,0x00,0x00, 0xE8,0x03,0xE8,0x03, 0xE9,0x03,0xEC,0x03, 0x00,0x00,0x01,0x00];
#pragma warning restore format

    public SupportedProtocol Protocol => SupportedProtocol.V380;

    // About 650 ms a step (auth, connect, warm-up frames, drain): 25 steps, 16 s, cover the whole pan/tilt range.
    public int FullRangeSteps => 25;

    public async Task<bool> ProbeAsync(Camera camera, CameraCapabilityBinding binding, CancellationToken ct = default)
    {
        await V380DeviceIdBootstrap.PreloadAsync(camera, binding, client, onvif, ct);

        var success = await client.ProbeAsync(camera, ct);

        // Persist the discovered deviceId so future PTZ commands work without discovery.
        // (The use case layer calls binding.SaveAsync after ProbeAsync returns.)
        if (success)
            V380DeviceIdBootstrap.PersistIfDiscovered(binding, client, camera.Host);

        return success;
    }

    // Sends one step packet; V380 has no continuous move without a persistent stream loop.
    public async Task<bool> PtzStepAsync(Camera camera, CameraCapabilityBinding binding, PtzDirection direction, int speed, CancellationToken ct = default)
    {
        if (V380DeviceIdBootstrap.TryReadDeviceId(binding.ConfigJson, out var storedId))
            client.PreloadDeviceId(camera.Host, storedId);

        try
        {
            await client.SendStreamCommandAsync(camera, DirectionToPacket(direction).ToArray(), ct);
            return true;
        }
        catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
        {
            logger.LogWarning(ex, "V380 PTZ step failed for {Camera}.", camera.DisplayName);
            // V380Client raises InvalidOperationException when the camera rejects its login or has no known device ID.
            throw ex is InvalidOperationException
                ? new CameraCommandRefusedException($"V380 PTZ step on {camera.Host}: {ex.Message}", ex)
                : new CameraUnreachableException($"V380 PTZ step on {camera.Host}: {ex.Message}", ex);
        }
    }

    public Task<(float Pan, float Tilt)?> GetPtzPositionAsync(Camera camera, CameraCapabilityBinding binding, CancellationToken ct = default)
        => Task.FromResult<(float Pan, float Tilt)?>(null);

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

#pragma warning disable format // Aligned as a table so each row reads against the others.
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
#pragma warning restore format
}
