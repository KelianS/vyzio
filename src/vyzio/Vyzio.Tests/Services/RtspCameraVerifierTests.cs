using System.Net;
using System.Net.Sockets;
using System.Text;
using Microsoft.Extensions.Time.Testing;
using Vyzio.Core.Entities;
using Vyzio.Infrastructure.Services;
using Vyzio.Tests.Services.Hosting;

namespace Vyzio.Tests.Services;

public class RtspCameraVerifierTests
{
    [Fact]
    public async Task VerifyAsync_returns_needs_attention_when_rtsp_requires_authentication()
    {
        using var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();

        var port = ((IPEndPoint)listener.LocalEndpoint).Port;
        var serverTask = Task.Run(async () =>
        {
            using var client = await listener.AcceptTcpClientAsync();
            using var stream = client.GetStream();

            var buffer = new byte[2048];
            _ = await stream.ReadAsync(buffer);

            var payload = Encoding.ASCII.GetBytes("RTSP/1.0 401 Unauthorized\r\nCSeq: 1\r\nWWW-Authenticate: Digest realm=\"Camera\"\r\n\r\n");
            await stream.WriteAsync(payload);
            await stream.FlushAsync();
        });

        // Never advanced, so the verdict comes from what the listener answered, not from how fast it did.
        var sut = new RtspCameraVerifier(new FakeTimeProvider());
        var result = await sut.VerifyAsync(new Camera
        {
            Slug = "front-door",
            FrigateCameraName = "front_door",
            DisplayName = "Front Door",
            Host = "127.0.0.1",
            Port = port,
            StreamPath = "/stream1",
        }).ObservedAsync();

        await serverTask;

        Assert.True(result.Connected);
        Assert.False(result.PreviewAvailable);
        Assert.Equal("needs_attention", result.Status);
        Assert.Contains("authentification", result.Guidance, StringComparison.OrdinalIgnoreCase);
    }
}
