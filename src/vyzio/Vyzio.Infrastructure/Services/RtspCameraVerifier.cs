using System.Net.Sockets;
using System.Text;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.Services;

public sealed class RtspCameraVerifier : ICameraVerifier
{
    public async Task<CameraVerificationResult> VerifyAsync(Camera camera, CancellationToken ct = default)
    {
        var checkedAt = DateTimeOffset.UtcNow;

        try
        {
            using var client = new TcpClient();
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(TimeSpan.FromSeconds(3));

            await client.ConnectAsync(camera.Host, camera.Port, timeout.Token);
            var previewAvailable = await ProbeRtspAsync(client, camera, timeout.Token);

            return previewAvailable
                ? new CameraVerificationResult(
                    true,
                    true,
                    "online",
                    "Camera responded to the stream verification.",
                    checkedAt,
                    checkedAt)
                : new CameraVerificationResult(
                    true,
                    false,
                    "degraded",
                    "Camera network endpoint is reachable, but the stream response could not be confirmed.",
                    checkedAt,
                    null);
        }
        catch
        {
            return new CameraVerificationResult(
                false,
                false,
                "offline",
                "Camera is unreachable. Check host, port, and stream path.",
                checkedAt,
                null);
        }
    }

    private static async Task<bool> ProbeRtspAsync(TcpClient client, Camera camera, CancellationToken ct)
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
            return false;
        }

        var response = Encoding.ASCII.GetString(buffer, 0, read);
        return response.Contains("RTSP/1.0 200", StringComparison.OrdinalIgnoreCase)
            || response.Contains("RTSP/1.0 401", StringComparison.OrdinalIgnoreCase);
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
}