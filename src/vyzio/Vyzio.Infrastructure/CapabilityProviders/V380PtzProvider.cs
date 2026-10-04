using Microsoft.Extensions.Logging;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.VendorAdapters;

namespace Vyzio.Infrastructure.CapabilityProviders;

// IPtzCapabilityProvider for the V380 Pro proprietary port-8800 protocol.
// Each step sends one 16-byte PTZ packet on the stream connection (~100ms movement).
// Continuous move is not supported — the protocol requires a persistent stream loop for
// sustained movement, which is not implemented here (step-based PTZ is sufficient, ADR-22).
// The device id comes from V380DeviceIdBootstrap (ADR-61).
internal sealed class V380PtzProvider(
    V380Client client,
    PtzMoveRunner runner,
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

    // The motion time a packet counts, so that its positions share the unit of the others (ADR-60).
    private static readonly TimeSpan PacketLength = TimeSpan.FromMilliseconds(100);

    // 23 packets, plus the calibration margin: the 25 that cover the whole pan/tilt range at about 650 ms each.
    public TimeSpan FullRange => 23 * PacketLength;

    // The device number and the login are the protocol's check; V380 has no read that shows a head, so the user confirms (ADR-66).
    public Task<CapabilityProof> ProveAsync(Camera camera, CameraCapabilityBinding binding, CancellationToken ct = default)
        => Task.FromResult(CapabilityProof.Unprovable());

    // Nothing opened ahead: the camera sets how far a packet moves, so the stream opened per packet does not change it (ADR-60).
    public Task<IPtzMotion> OpenMotionAsync(Camera camera, CameraCapabilityBinding binding, CancellationToken ct = default)
        => Task.FromResult<IPtzMotion>(new Motion(this, runner, camera, binding, logger));

    private sealed class Motion(V380PtzProvider provider, PtzMoveRunner runner, Camera camera, CameraCapabilityBinding binding, ILogger logger)
        : PtzSteppedMotion(runner, camera, PacketLength, logger)
    {
        protected override Task StepAsync(PtzDirection direction, int speed, CancellationToken ct)
            => provider.StepAsync(Camera, binding, direction, ct);
    }

    // Sends one step packet; V380 has no continuous move without a persistent stream loop.
    private async Task StepAsync(Camera camera, CameraCapabilityBinding binding, PtzDirection direction, CancellationToken ct)
    {
        V380DeviceIdBootstrap.PreloadStored(camera, client);

        try
        {
            await client.SendStreamCommandAsync(camera, DirectionToPacket(direction).ToArray(), ct);
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
