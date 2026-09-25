using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Logging.Abstractions;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.Services;

namespace Vyzio.Tests.Services;

public sealed class RtspAccountProbeTests : IDisposable
{
    private const string Challenge = "WWW-Authenticate: Digest realm=\"cam\", nonce=\"abc123\"\r\n";
    private readonly TcpListener _listener = new(IPAddress.Loopback, 0);
    private readonly List<string> _requests = [];

    public RtspAccountProbeTests() => _listener.Start();

    public void Dispose() => _listener.Stop();

    private int Port => ((IPEndPoint)_listener.LocalEndpoint).Port;

    private Camera MakeCamera(string? username = "viewer", string? password = "placeholder-pass") => new()
    {
        Id = "cam1",
        Slug = "cam1",
        FrigateCameraName = "cam1",
        DisplayName = "cam1",
        Host = "127.0.0.1",
        Port = Port,
        StreamPath = "stream1",
        Username = username,
        Password = password,
    };

    // A camera answering each connection with the next scripted reply, recording what it was asked.
    private Task Serve(params string[] replies) => Task.Run(async () =>
    {
        foreach (var reply in replies)
        {
            using var client = await _listener.AcceptTcpClientAsync();
            var stream = client.GetStream();
            var buffer = new byte[4096];
            var read = await stream.ReadAsync(buffer);
            _requests.Add(Encoding.ASCII.GetString(buffer, 0, read));
            await stream.WriteAsync(Encoding.ASCII.GetBytes(reply));
        }
    });

    private static RtspAccountProbe Probe() => new(TimeProvider.System, NullLogger<RtspAccountProbe>.Instance);

    [Fact]
    public async Task CheckAsync_ShouldAccept_WhenTheCameraAsksForNoAccount()
    {
        var camera = Serve("RTSP/1.0 200 OK\r\nCSeq: 1\r\n\r\n");

        Assert.Equal(RtspAccountCheck.Accepted, await Probe().CheckAsync(MakeCamera()));
        await camera;
        Assert.DoesNotContain("Authorization", Assert.Single(_requests), StringComparison.Ordinal);
    }

    [Fact]
    public async Task CheckAsync_ShouldAnswerTheDigestChallengeWithTheCameraAccount_WhenAsked()
    {
        var camera = Serve($"RTSP/1.0 401 Unauthorized\r\nCSeq: 1\r\n{Challenge}\r\n", "RTSP/1.0 200 OK\r\nCSeq: 2\r\n\r\n");

        Assert.Equal(RtspAccountCheck.Accepted, await Probe().CheckAsync(MakeCamera()));
        await camera;

        var uri = $"rtsp://127.0.0.1:{Port}/stream1";
        var ha1 = Md5("viewer:cam:placeholder-pass");
        var ha2 = Md5($"DESCRIBE:{uri}");
        Assert.DoesNotContain("Authorization", _requests[0], StringComparison.Ordinal);
        Assert.Contains($"response=\"{Md5($"{ha1}:abc123:{ha2}")}\"", _requests[1], StringComparison.Ordinal);
        Assert.All(_requests, request => Assert.DoesNotContain("placeholder-pass", request, StringComparison.Ordinal));
    }

    [Fact]
    public async Task CheckAsync_ShouldRefuse_WhenTheCameraRejectsTheAccount()
    {
        var camera = Serve(
            $"RTSP/1.0 401 Unauthorized\r\nCSeq: 1\r\n{Challenge}\r\n",
            $"RTSP/1.0 401 Unauthorized\r\nCSeq: 2\r\n{Challenge}\r\n");

        Assert.Equal(RtspAccountCheck.Refused, await Probe().CheckAsync(MakeCamera()));
        await camera;
        Assert.Equal(2, _requests.Count);
    }

    [Fact]
    public async Task CheckAsync_ShouldRefuseWithoutSendingAnything_WhenTheCameraAsksAndVyzioHoldsNoAccount()
    {
        var camera = Serve($"RTSP/1.0 401 Unauthorized\r\nCSeq: 1\r\n{Challenge}\r\n");

        Assert.Equal(RtspAccountCheck.Refused, await Probe().CheckAsync(MakeCamera(username: null, password: null)));
        await camera;
        Assert.Single(_requests);
    }

    [Fact]
    public async Task CheckAsync_ShouldReportNoAnswer_WhenNothingListens()
    {
        var port = Port;
        _listener.Stop();
        var camera = MakeCamera();
        camera.Port = port;

        Assert.Equal(RtspAccountCheck.NoAnswer, await Probe().CheckAsync(camera));
    }

#pragma warning disable CA5351 // The test recomputes the RFC 2617 Digest the camera would check.
    private static string Md5(string value) => Convert.ToHexStringLower(MD5.HashData(Encoding.UTF8.GetBytes(value)));
#pragma warning restore CA5351
}
