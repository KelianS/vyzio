using System.Net.Sockets;
using Microsoft.Extensions.Logging;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.CapabilityProviders;
using Vyzio.Infrastructure.VendorAdapters;

namespace Vyzio.Infrastructure.Services;

// The protocol level's check: reach the protocol, then log in once with its account; never a guessed account (ADR-61).
internal sealed class CameraProtocolProbe(
    OnvifEndpointResolver onvifResolver,
    OnvifClient onvif,
    DvripClient dvrip,
    V380Client v380,
    TapoKlapProvider tapo,
    TimeProvider time,
    ILogger<CameraProtocolProbe> logger) : ICameraProtocolProbe
{
    private static readonly TimeSpan TcpTimeout = TimeSpan.FromSeconds(3);

    public async Task<ProtocolAnswer> ProbeAsync(Camera camera, SupportedProtocol protocol, CancellationToken ct = default)
    {
        try
        {
            var reach = protocol == SupportedProtocol.Onvif
                ? await ReachOnvifAsync(camera, ct)
                : await ReachPortAsync(camera, protocol, ct);
            return reach.Status == ProtocolStatus.Answers ? await LoginAsync(camera, protocol, ct) : reach;
        }
        catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
        {
            // A client failure no login check maps is still an answer about the protocol, never a crashed probe.
            logger.LogWarning(ex, "{Protocol} check on {Host} failed outside any known answer.", protocol, camera.Host);
            return ProtocolAnswer.Unreachable($"{protocol}: the check on {camera.Host} failed ({ex.GetType().Name}: {ex.Message}).");
        }
    }

    private async Task<ProtocolAnswer> LoginAsync(Camera camera, SupportedProtocol protocol, CancellationToken ct)
    {
        switch (protocol)
        {
            case SupportedProtocol.Rtsp:
                return await RtspLogin.CheckAsync(camera, time, ct);
            case SupportedProtocol.Onvif:
                return await onvif.CheckLoginAsync(camera, ct);
            case SupportedProtocol.Dvrip:
                return await dvrip.CheckLoginAsync(camera, ct);
            case SupportedProtocol.V380:
                // The device number comes from the row, then the ONVIF serial, then discovery; a found one is kept.
                await V380DeviceIdBootstrap.PreloadAsync(camera, v380, onvif, ct);
                var answer = await v380.CheckLoginAsync(camera, time, ct);
                V380DeviceIdBootstrap.PersistIfDiscovered(camera, v380);
                return answer;
            case SupportedProtocol.TapoKlap:
                return await tapo.CheckLoginAsync(camera, time, ct);
            default:
                throw new ArgumentOutOfRangeException(nameof(protocol), protocol, null);
        }
    }

    private async Task<ProtocolAnswer> ReachOnvifAsync(Camera camera, CancellationToken ct)
        => await onvifResolver.ResolveAsync(camera, ct) is not null
            ? ProtocolAnswer.Answers()
            : ProtocolAnswer.Unreachable($"No ONVIF service answered on {camera.Host}.");

    private async Task<ProtocolAnswer> ReachPortAsync(Camera camera, SupportedProtocol protocol, CancellationToken ct)
    {
        var port = camera.PortOf(protocol);
        try
        {
            using var expiry = new CancellationTokenSource(TcpTimeout, time);
            using var linked = CancellationTokenSource.CreateLinkedTokenSource(ct, expiry.Token);
            using var tcp = new TcpClient();
            await tcp.ConnectAsync(camera.Host, port, linked.Token);
            return ProtocolAnswer.Answers();
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (OperationCanceledException)
        {
            return ProtocolAnswer.Unreachable($"{protocol}: no answer on {camera.Host}:{port} within {TcpTimeout.TotalSeconds:0} s.");
        }
        catch (SocketException ex)
        {
            return ProtocolAnswer.Unreachable($"{protocol}: {camera.Host}:{port} refused the connection ({ex.SocketErrorCode}).");
        }
    }
}
