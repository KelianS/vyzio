using System.Net.Sockets;
using System.Text;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.Services;

public sealed class RtspCameraVerifier : ICameraVerifier
{
    public async Task<CameraVerificationResult> VerifyAsync(Camera camera, CancellationToken ct = default)
    {
        if (camera.StreamProtocol == StreamProtocol.Dvrip)
        {
            return await VerifyDvripAsync(camera, ct);
        }

        var checkedAt = DateTimeOffset.UtcNow;

        try
        {
            using var client = new TcpClient();
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(TimeSpan.FromSeconds(3));

            await client.ConnectAsync(camera.Host, camera.Port, timeout.Token);
            var probeResult = await ProbeRtspAsync(client, camera, timeout.Token);

            return probeResult switch
            {
                RtspProbeResult.Success => new CameraVerificationResult(
                    true,
                    true,
                    "online",
                    "Le flux RTSP repond correctement.",
                    checkedAt,
                    checkedAt),
                RtspProbeResult.AuthenticationRequired => new CameraVerificationResult(
                    true,
                    false,
                    "needs_attention",
                    "Le flux RTSP repond, mais la camera demande une authentification. Renseignez l'utilisateur et le mot de passe puis relancez la verification.",
                    checkedAt,
                    null),
                _ => new CameraVerificationResult(
                    true,
                    false,
                    "degraded",
                    "La camera repond sur le reseau, mais le flux RTSP n'a pas pu etre confirme.",
                    checkedAt,
                    null)
            };
        }
        catch
        {
            return new CameraVerificationResult(
                false,
                false,
                "offline",
                "Camera injoignable. Verifiez l'hote, le port et le chemin RTSP.",
                checkedAt,
                null);
        }
    }

    private static async Task<CameraVerificationResult> VerifyDvripAsync(Camera camera, CancellationToken ct)
    {
        var checkedAt = DateTimeOffset.UtcNow;
        try
        {
            using var client = new TcpClient();
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(TimeSpan.FromSeconds(5));
            await client.ConnectAsync(camera.Host, camera.Port, timeout.Token);
            return new CameraVerificationResult(
                true,
                true,
                "online",
                "Port DVRIP/XMEye joignable. La camera sera integree via go2rtc au moment de l'application de la configuration.",
                checkedAt,
                checkedAt);
        }
        catch
        {
            return new CameraVerificationResult(
                false,
                false,
                "needs_attention",
                "Camera DVRIP injoignable. Si c'est une camera sur batterie, réveillez-la via l'application ICSee/XMEye puis relancez la verification.",
                checkedAt,
                null);
        }
    }

    private static async Task<RtspProbeResult> ProbeRtspAsync(TcpClient client, Camera camera, CancellationToken ct)
    {
        var stream = client.GetStream();
        var requestUri = BuildRtspUri(camera);
        var request = $"OPTIONS {requestUri} RTSP/1.0\r\nCSeq: 1\r\nUser-Agent: Vyzio\r\n\r\n";
        var bytes = Encoding.ASCII.GetBytes(request);

        await stream.WriteAsync(bytes, ct);
        await stream.FlushAsync(ct);

        var buffer = new byte[2048];
        var read = await stream.ReadAsync(buffer, ct);
        if (read <= 0)
        {
            return RtspProbeResult.Unknown;
        }

        var response = Encoding.ASCII.GetString(buffer, 0, read);
        if (response.Contains("RTSP/1.0 200", StringComparison.OrdinalIgnoreCase))
        {
            return RtspProbeResult.Success;
        }

        if (response.Contains("RTSP/1.0 401", StringComparison.OrdinalIgnoreCase))
        {
            return RtspProbeResult.AuthenticationRequired;
        }

        return RtspProbeResult.Unknown;
    }

    private static string BuildRtspUri(Camera camera)
    {
        var builder = new UriBuilder("rtsp", camera.Host, camera.Port);

        if (!string.IsNullOrWhiteSpace(camera.StreamPath))
        {
            builder.Path = camera.StreamPath!.TrimStart('/');
        }

        if (!string.IsNullOrWhiteSpace(camera.Username))
        {
            builder.UserName = camera.Username;
            builder.Password = camera.Password ?? string.Empty;
        }

        return builder.Uri.ToString();
    }

    private enum RtspProbeResult
    {
        Unknown,
        Success,
        AuthenticationRequired,
    }
}