using System.Net;
using System.Net.Sockets;
using System.Text;
using Microsoft.Extensions.Time.Testing;
using Vyzio.Core.Entities;
using Vyzio.Infrastructure.Configuration;
using Vyzio.Infrastructure.Services;
using Vyzio.Tests.Services.Hosting;

namespace Vyzio.Tests.Services;

public class AssistedCameraDiscoveryServiceTests
{
    private const string Loopback = "127.0.0.1";

    // Never advanced: a probe ends when the loopback listener answers, however slow the machine is.
    private readonly FakeTimeProvider _time = BackgroundLoop.ClockAt("2026-09-23T10:00:00+00:00");

    private AssistedCameraDiscoveryService Discovery(VyzioRuntimeSettings settings) => new(settings, _time);

    // Every probe here must land on a loopback listener this test owns, on a port the OS just
    // handed out — never a well-known one, which collides with whatever the machine happens to be
    // running. Hence the port → fingerprint mapping being declared per test rather than inherited
    // from the catalog, and the LAN multicast being off.
    private static VyzioRuntimeSettings HermeticSettings(
        IReadOnlyList<string>? probeHosts = null,
        IReadOnlyList<string>? probeCidrs = null,
        IReadOnlyList<int>? rtspPorts = null,
        IReadOnlyList<int>? httpPorts = null,
        IReadOnlyList<int>? scanPorts = null,
        IReadOnlyDictionary<int, SupportedProtocol>? portFingerprints = null,
        string? vendorCatalogPath = null) => new()
        {
            Documentation = new VyzioRuntimeSettings.DocumentationSettings
            {
                VendorCatalogPath = vendorCatalogPath ?? string.Empty
            },
            Discovery = new VyzioRuntimeSettings.DiscoverySettings
            {
                ProbeHosts = probeHosts ?? (probeCidrs is null ? [Loopback] : []),
                ProbeCidrs = probeCidrs ?? [],
                RtspPortsOverride = rtspPorts ?? [],
                HttpPortsOverride = httpPorts ?? [],
                ScanPortsOverride = scanPorts ?? [],
                PortFingerprintsOverride = portFingerprints ?? new Dictionary<int, SupportedProtocol>(),
                OnvifMulticastEnabled = false,
                ProbeTimeoutMs = 500,
                MaxConcurrentProbes = 1,
            }
        };

    // Binds loopback on an OS-assigned port, so no test hard-codes a port number.
    private static TcpListener StartLoopbackListener()
    {
        var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        return listener;
    }

    private static int PortOf(TcpListener listener) => ((IPEndPoint)listener.LocalEndpoint).Port;

    [Fact]
    public async Task DiscoverAsync_ShouldConfirmTheCameraFromRtsp_WhenTheConfiguredProbeHostAnswersDescribe()
    {
        using var listener = StartLoopbackListener();
        var port = PortOf(listener);

        using var stopServer = new CancellationTokenSource();
        var serverTask = RespondRtspOkAsync(listener, stopServer.Token);

        var sut = Discovery(HermeticSettings(rtspPorts: [port]));

        var result = await sut.DiscoverAsync().ObservedAsync();

        stopServer.Cancel();
        await serverTask;
        var candidate = Assert.Single(result, item => item.Host == Loopback && item.Port == port);
        Assert.Equal("rtsp_describe", candidate.DiscoverySource);
        Assert.Equal("camera_confirmed", candidate.Qualification);
        Assert.Equal("unknown", candidate.SupportLevel);
        Assert.Contains("rtsp_responding", candidate.QualificationReasons);
        Assert.Equal("/stream1", candidate.StreamPath);
        Assert.Null(candidate.MacAddress);
        Assert.NotNull(candidate.TechnicalDetails);
        // The detected-ports table is sourced from the catalog port sweep (fixed ports), not from
        // the RTSP DESCRIBE probe's random test port — so it's the stream path that's asserted here.
        Assert.Equal(["/stream1"], candidate.TechnicalDetails!.RtspPathsDetected);
    }

    // CIDR enumeration reaches a live host, which is then enriched (here RTSP DESCRIBE finds a
    // usable path). 127.0.0.1/32 → 127.0.0.1, identified via ping (loopback).
    [Fact]
    public async Task DiscoverAsync_ShouldConfirmTheCameraFromRtsp_WhenItsHostIsReachedThroughAConfiguredCidr()
    {
        using var listener = StartLoopbackListener();
        var port = PortOf(listener);

        using var stopServer = new CancellationTokenSource();
        var serverTask = RespondRtspOkAsync(listener, stopServer.Token);

        var sut = Discovery(
            HermeticSettings(probeCidrs: ["127.0.0.1/32"], rtspPorts: [port]));

        var result = await sut.DiscoverAsync().ObservedAsync();
        stopServer.Cancel();
        await serverTask;

        var candidate = Assert.Single(result, item => item.Host == Loopback && item.Port == port);
        Assert.Equal("rtsp_describe", candidate.DiscoverySource);
        Assert.Equal("camera_confirmed", candidate.Qualification);
        Assert.Contains("rtsp_responding", candidate.QualificationReasons);
    }

    // Loop-accept helper: answers every request with an RTSP 200 (enough for DESCRIBE/OPTIONS).
    private static Task RespondRtspOkAsync(TcpListener listener, CancellationToken ct) => Task.Run(async () =>
    {
        try
        {
            while (!ct.IsCancellationRequested)
            {
                using var client = await listener.AcceptTcpClientAsync(ct);
                using var stream = client.GetStream();
                var buffer = new byte[1024];
                _ = await stream.ReadAsync(buffer, ct);
                var payload = "RTSP/1.0 200 OK\r\nCSeq: 1\r\nContent-Length: 0\r\n\r\n";
                await stream.WriteAsync(Encoding.ASCII.GetBytes(payload), ct);
                await stream.FlushAsync(ct);
            }
        }
        catch (OperationCanceledException) { }
        catch (System.Net.Sockets.SocketException) { }
    }, ct);

    // Loop-accept helper: answers every request with the given raw HTTP response.
    private static Task RespondHttpAsync(TcpListener listener, string response, CancellationToken ct) => Task.Run(async () =>
    {
        try
        {
            while (!ct.IsCancellationRequested)
            {
                using var client = await listener.AcceptTcpClientAsync(ct);
                using var stream = client.GetStream();
                var buffer = new byte[1024];
                _ = await stream.ReadAsync(buffer, ct);
                await stream.WriteAsync(Encoding.UTF8.GetBytes(response), ct);
                await stream.FlushAsync(ct);
            }
        }
        catch (OperationCanceledException) { }
        catch (System.Net.Sockets.SocketException) { }
    }, ct);

    [Fact]
    public async Task DiscoverAsync_ShouldReturnALikelyTapoCamera_WhenTheWebPageCarriesATapoSignature()
    {
        using var listener = StartLoopbackListener();
        var port = PortOf(listener);

        using var stopServer = new CancellationTokenSource();
        var serverTask = RespondHttpAsync(
            listener,
            "HTTP/1.1 200 OK\r\nServer: TP-Link Tapo\r\nContent-Type: text/html\r\nConnection: close\r\n\r\n<html><head><title>Tapo Camera</title></head><body>Tapo</body></html>",
            stopServer.Token);

        var sut = Discovery(HermeticSettings(httpPorts: [port]));

        var result = await sut.DiscoverAsync().ObservedAsync();
        stopServer.Cancel();
        await serverTask;

        var candidate = Assert.Single(result, item => item.Host == Loopback && item.Port == port);
        Assert.Equal("http_probe", candidate.DiscoverySource);
        Assert.Equal("web_setup", candidate.SourceType);
        Assert.Equal("camera_likely", candidate.Qualification);
        Assert.Equal("guided", candidate.SupportLevel);
        Assert.Equal("tplink_tapo", candidate.VendorFamily);
        Assert.Contains("http_camera_signature", candidate.QualificationReasons);
        Assert.Contains("Tapo", candidate.Note);
        Assert.Null(candidate.MacAddress);
    }

    [Fact]
    public async Task DiscoverAsync_ShouldReturnAnUnknownDevice_WhenTheWebPageHasNoCameraSignature()
    {
        using var listener = StartLoopbackListener();
        var port = PortOf(listener);

        using var stopServer = new CancellationTokenSource();
        var serverTask = RespondHttpAsync(
            listener,
            "HTTP/1.1 200 OK\r\nServer: nginx\r\nContent-Type: text/html\r\nConnection: close\r\n\r\n<html><head><title>Admin Portal</title></head><body>hello</body></html>",
            stopServer.Token);

        var sut = Discovery(HermeticSettings(httpPorts: [port]));

        var result = await sut.DiscoverAsync().ObservedAsync();
        stopServer.Cancel();
        await serverTask;

        var candidate = Assert.Single(result, item => item.Host == Loopback && item.Port == port);
        Assert.Equal("http_service", candidate.DiscoverySource);
        Assert.Equal("device_unknown", candidate.Qualification);
        Assert.Contains("http_service_detected", candidate.QualificationReasons);
        Assert.DoesNotContain("http_camera_signature", candidate.QualificationReasons);
    }

    // ADR-32: ONVIF is detected by the port-sweep SOAP fingerprint, regardless of any web UI —
    // which confirms the protocol, hence the ONVIF capability. Which ports carry that fingerprint
    // in production is the catalog's business, asserted in DiscoveryPortCatalogTests.
    [Fact]
    public async Task DiscoverAsync_ShouldConfirmOnvif_WhenASweptPortPassesTheOnvifFingerprint()
    {
        using var listener = StartLoopbackListener();
        var onvifPort = PortOf(listener);

        using var stopServer = new CancellationTokenSource();
        var serverTask = RespondOnvifAsync(listener, stopServer.Token);

        var sut = Discovery(HermeticSettings(
            scanPorts: [onvifPort],
            portFingerprints: new Dictionary<int, SupportedProtocol> { [onvifPort] = SupportedProtocol.Onvif }));

        var result = await sut.DiscoverAsync().ObservedAsync();
        stopServer.Cancel();
        await serverTask;

        var candidate = Assert.Single(result, item => item.Host == Loopback);
        Assert.Equal("camera_confirmed", candidate.Qualification);
        var port = Assert.Single(candidate.TechnicalDetails!.DetectedPorts);
        Assert.Equal(onvifPort, port.Port);
        Assert.Equal("Onvif", port.Protocol);
    }

    [Fact]
    public async Task DiscoverAsync_ShouldConfirmOnvif_WhenTheCameraServesItOnASingleEndpoint()
    {
        using var listener = StartLoopbackListener();
        var onvifPort = PortOf(listener);

        using var stopServer = new CancellationTokenSource();
        var serverTask = RespondOnvifOnSingleEndpointAsync(listener, stopServer.Token);

        var sut = Discovery(HermeticSettings(
            scanPorts: [onvifPort],
            portFingerprints: new Dictionary<int, SupportedProtocol> { [onvifPort] = SupportedProtocol.Onvif }));

        var result = await sut.DiscoverAsync().ObservedAsync();
        stopServer.Cancel();
        await serverTask;

        var candidate = Assert.Single(result, item => item.Host == Loopback);
        Assert.Equal("camera_confirmed", candidate.Qualification);
        Assert.Equal("Onvif", Assert.Single(candidate.TechnicalDetails!.DetectedPorts).Protocol);
    }

    [Fact]
    public async Task DiscoverAsync_ShouldConfirmOnvif_WhenTheServiceDemandsAuthentication()
    {
        using var listener = StartLoopbackListener();
        var onvifPort = PortOf(listener);

        using var stopServer = new CancellationTokenSource();
        var serverTask = RespondAsync(listener,
            "HTTP/1.1 401 Unauthorized\r\nWWW-Authenticate: Digest realm=\"ONVIF\", nonce=\"n\"\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
            stopServer.Token);

        var sut = Discovery(HermeticSettings(
            scanPorts: [onvifPort],
            portFingerprints: new Dictionary<int, SupportedProtocol> { [onvifPort] = SupportedProtocol.Onvif }));

        var result = await sut.DiscoverAsync().ObservedAsync();
        stopServer.Cancel();
        await serverTask;

        Assert.Equal("camera_confirmed", Assert.Single(result, item => item.Host == Loopback).Qualification);
    }

    private static Task RespondAsync(TcpListener listener, string reply, CancellationToken ct) => Task.Run(async () =>
    {
        try
        {
            while (!ct.IsCancellationRequested)
            {
                using var client = await listener.AcceptTcpClientAsync(ct);
                using var stream = client.GetStream();
                var buffer = new byte[2048];
                _ = await stream.ReadAsync(buffer, ct);
                await stream.WriteAsync(Encoding.UTF8.GetBytes(reply), ct);
                await stream.FlushAsync(ct);
            }
        }
        catch (OperationCanceledException) { }
        catch (System.Net.Sockets.SocketException) { }
        catch (IOException) { }
    }, ct);

    // Shaped like a Tapo (ADR-56): 404 on the common path, every service on /onvif/service.
    private static Task RespondOnvifOnSingleEndpointAsync(TcpListener listener, CancellationToken ct) => Task.Run(async () =>
    {
        const string notFound = "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
        const string answer = "HTTP/1.1 200 OK\r\nContent-Type: application/soap+xml\r\nConnection: close\r\n\r\n<s:Envelope xmlns:s=\"http://www.w3.org/2003/05/soap-envelope\" xmlns:tds=\"http://www.onvif.org/ver10/device/wsdl\"><s:Body><tds:GetSystemDateAndTimeResponse/></s:Body></s:Envelope>";
        try
        {
            while (!ct.IsCancellationRequested)
            {
                using var client = await listener.AcceptTcpClientAsync(ct);
                using var stream = client.GetStream();
                var buffer = new byte[2048];
                var read = await stream.ReadAsync(buffer, ct);
                var request = Encoding.UTF8.GetString(buffer, 0, read);
                var reply = request.StartsWith("POST /onvif/service ", StringComparison.Ordinal) ? answer : notFound;
                await stream.WriteAsync(Encoding.UTF8.GetBytes(reply), ct);
                await stream.FlushAsync(ct);
            }
        }
        catch (OperationCanceledException) { }
        catch (System.Net.Sockets.SocketException) { }
        catch (IOException) { }
    }, ct);

    // Loop-accept helper answering only genuine ONVIF SOAP requests with a valid ONVIF reply.
    private static Task RespondOnvifAsync(TcpListener listener, CancellationToken ct) => Task.Run(async () =>
    {
        const string payload = "HTTP/1.1 200 OK\r\nContent-Type: application/soap+xml\r\nConnection: close\r\n\r\n<s:Envelope xmlns:s=\"http://www.w3.org/2003/05/soap-envelope\" xmlns:tds=\"http://www.onvif.org/ver10/device/wsdl\"><s:Body><tds:GetCapabilitiesResponse/></s:Body></s:Envelope>";
        try
        {
            while (!ct.IsCancellationRequested)
            {
                using var client = await listener.AcceptTcpClientAsync(ct);
                using var stream = client.GetStream();
                var buffer = new byte[2048];
                var read = await stream.ReadAsync(buffer, ct);
                var request = Encoding.UTF8.GetString(buffer, 0, read);
                // Only answer the ONVIF probe (POST /onvif/device_service); ignore anything else.
                if (request.Contains("device_service", StringComparison.OrdinalIgnoreCase))
                {
                    await stream.WriteAsync(Encoding.UTF8.GetBytes(payload), ct);
                    await stream.FlushAsync(ct);
                }
            }
        }
        catch (OperationCanceledException) { }
        catch (System.Net.Sockets.SocketException) { }
    }, ct);

    // ADR-32: an identified host that matches no protocol/vendor signal no longer disappears —
    // it now surfaces as a device_unknown "network_host" baseline candidate (backlog: "show
    // everything found, even unmatched, at lower priority"). This replaces the old expectation
    // that a rejected SOAP gateway produced literally zero output.
    // A SOAP gateway with no ONVIF markers must NOT be confirmed as ONVIF: the fingerprint fails,
    // so the open port surfaces as an unidentified open port, device_unknown.
    [Fact]
    public async Task DiscoverAsync_ShouldReportAnUnidentifiedPort_WhenAGenericSoapGatewayAnswersWithoutOnvifMarkers()
    {
        using var listener = StartLoopbackListener();
        var port = PortOf(listener);

        using var stopServer = new CancellationTokenSource();
        var serverTask = Task.Run(async () =>
        {
            const string payload = "HTTP/1.1 401 Unauthorized\r\nContent-Type: application/soap+xml\r\nConnection: close\r\n\r\n<s:Envelope xmlns:s=\"http://www.w3.org/2003/05/soap-envelope\"><s:Body><s:Fault><s:Reason><s:Text xml:lang=\"en\">Unauthorized</s:Text></s:Reason></s:Fault></s:Body></s:Envelope>";
            try
            {
                while (!stopServer.IsCancellationRequested)
                {
                    using var client = await listener.AcceptTcpClientAsync(stopServer.Token);
                    using var stream = client.GetStream();
                    var buffer = new byte[2048];
                    _ = await stream.ReadAsync(buffer, stopServer.Token);
                    await stream.WriteAsync(Encoding.UTF8.GetBytes(payload), stopServer.Token);
                    await stream.FlushAsync(stopServer.Token);
                }
            }
            catch (OperationCanceledException) { }
            catch (System.Net.Sockets.SocketException) { }
        });

        var sut = Discovery(HermeticSettings(
            scanPorts: [port],
            portFingerprints: new Dictionary<int, SupportedProtocol> { [port] = SupportedProtocol.Onvif }));

        var result = await sut.DiscoverAsync().ObservedAsync();
        stopServer.Cancel();
        await serverTask;

        var candidate = Assert.Single(result, item => item.Host == Loopback);
        Assert.Equal("device_unknown", candidate.Qualification);
        var detectedPort = Assert.Single(candidate.TechnicalDetails!.DetectedPorts);
        Assert.Equal("unknown", detectedPort.Protocol);
        Assert.DoesNotContain("onvif_detected", candidate.QualificationReasons);
    }

    [Fact]
    public async Task DiscoverAsync_ShouldReturnALikelyTapoCamera_WhenOnlyTheHostnameHintsAtIt()
    {
        var sut = Discovery(
            HermeticSettings(probeHosts: ["c200-camera-tapo.lan"]));

        var result = await sut.DiscoverAsync().ObservedAsync();

        var candidate = Assert.Single(result, item => item.Host == "c200-camera-tapo.lan");
        Assert.Equal("hostname_probe", candidate.DiscoverySource);
        Assert.Equal("camera_likely", candidate.Qualification);
        Assert.Equal("guided", candidate.SupportLevel);
        Assert.Equal("tplink_tapo", candidate.VendorFamily);
        Assert.Contains("hostname_camera_hint", candidate.QualificationReasons);
    }

    [Fact]
    public async Task DiscoverAsync_ShouldReturnALikelyV380CameraWithItsVendorGuide_WhenOnlyTheHostnameHintsAtIt()
    {
        var sut = Discovery(HermeticSettings(
            probeHosts: ["v380pro-camera.lan"],
            vendorCatalogPath: FindRepoPath("src", "vyzio", "vendors")));

        var result = await sut.DiscoverAsync().ObservedAsync();

        var candidate = Assert.Single(result, item => item.Host == "v380pro-camera.lan");
        Assert.Equal("hostname_probe", candidate.DiscoverySource);
        Assert.Equal("camera_likely", candidate.Qualification);
        Assert.Equal("guided", candidate.SupportLevel);
        Assert.Equal("v380_pro", candidate.VendorFamily);
        Assert.Contains("hostname_camera_hint", candidate.QualificationReasons);
        Assert.Contains("vendor_hint_detected", candidate.QualificationReasons);
        Assert.NotNull(candidate.VendorDocumentation);
        Assert.Contains("# V380 PRO", candidate.VendorDocumentation!.Markdown, StringComparison.Ordinal);
        Assert.Contains("https://gist.github.com/SolveSoul/9be5d9599c8b4b59f7cfa4cd0ce79c9c", candidate.VendorDocumentation.Markdown, StringComparison.Ordinal);
    }

    private static string FindRepoPath(params string[] parts)
    {
        var segments = new[] { AppContext.BaseDirectory, "..", "..", "..", "..", "..", ".." }
            .Concat(parts)
            .ToArray();

        return Path.GetFullPath(Path.Combine(segments));
    }

    [Fact]
    public async Task DiscoverAsync_ShouldReturnALikelyCamera_WhenTheHostnameStartsWithTheMvPrefix()
    {
        var sut = Discovery(HermeticSettings(probeHosts: ["MV26970853"]));

        var result = await sut.DiscoverAsync().ObservedAsync();

        var candidate = Assert.Single(result, item => item.Host == "MV26970853");
        Assert.Equal("hostname_probe", candidate.DiscoverySource);
        Assert.Equal("camera_likely", candidate.Qualification);
        Assert.Contains("hostname_camera_hint", candidate.QualificationReasons);
    }

    [Fact]
    public async Task DiscoverAsync_ShouldMergeIntoTheBestMatch_WhenRtspAndWebSignalsComeFromTheSameHost()
    {
        using var rtspListener = StartLoopbackListener();
        var rtspPort = PortOf(rtspListener);
        using var httpListener = StartLoopbackListener();
        var httpPort = PortOf(httpListener);

        using var stopServer = new CancellationTokenSource();

        var rtspServerTask = RespondRtspOkAsync(rtspListener, stopServer.Token);
        var httpServerTask = RespondHttpAsync(
            httpListener,
            "HTTP/1.1 200 OK\r\nServer: TP-Link Tapo\r\nContent-Type: text/html\r\nConnection: close\r\n\r\n<html><head><title>Tapo Camera</title></head><body>Tapo</body></html>",
            stopServer.Token);

        var sut = Discovery(
            HermeticSettings(rtspPorts: [rtspPort], httpPorts: [httpPort]));

        var result = await sut.DiscoverAsync().ObservedAsync();

        stopServer.Cancel();
        await Task.WhenAll(rtspServerTask, httpServerTask);

        var candidate = Assert.Single(result);
        Assert.Equal(Loopback, candidate.Host);
        Assert.Equal(rtspPort, candidate.Port);
        Assert.Equal("rtsp_describe", candidate.DiscoverySource);
        Assert.Equal("camera_confirmed", candidate.Qualification);
        Assert.Equal("tplink_tapo", candidate.VendorFamily);
        Assert.Contains("rtsp_responding", candidate.QualificationReasons);
        Assert.Contains("http_camera_signature", candidate.QualificationReasons);
        Assert.False(string.IsNullOrWhiteSpace(candidate.TechnicalDetails?.ResolvedHostName));
    }

    [Fact]
    public async Task DiscoverAsync_ShouldListTheConfirmedCameraFirst_WhenAnotherHostIsOnlyLikely()
    {
        using var listener = StartLoopbackListener();
        var rtspPort = PortOf(listener);

        using var stopServer = new CancellationTokenSource();
        var rtspServerTask = RespondRtspOkAsync(listener, stopServer.Token);

        var sut = Discovery(HermeticSettings(
            probeHosts: [Loopback, "c200-camera-tapo.lan"],
            rtspPorts: [rtspPort]));

        var result = await sut.DiscoverAsync().ObservedAsync();

        stopServer.Cancel();
        await rtspServerTask;

        Assert.Equal(2, result.Count);
        Assert.Equal(Loopback, result[0].Host);
        Assert.Equal("camera_confirmed", result[0].Qualification);
        Assert.Equal("c200-camera-tapo.lan", result[1].Host);
        Assert.Equal("camera_likely", result[1].Qualification);
    }

    // ADR-32: identification (Stage 1) is only a filter on what to enrich, never a filter on
    // what gets shown — a host with zero matching protocol/MAC/hostname signal must still surface
    // as device_unknown rather than vanish (this was the actual bug behind "plenty of devices are
    // still missing, not even shown as unidentified").
    [Fact]
    public async Task DiscoverAsync_ShouldStillShowTheHostAsUnknown_WhenAnIdentifiedHostMatchesNoSignal()
    {
        var sut = Discovery(HermeticSettings());

        var result = await sut.DiscoverAsync().ObservedAsync();

        var candidate = Assert.Single(result, item => item.Host == Loopback);
        Assert.Equal("network_host", candidate.DiscoverySource);
        Assert.Equal("device_unknown", candidate.Qualification);
        Assert.Empty(candidate.QualificationReasons);
    }

    // A baseline network_host signal must never win a merge against a real detection for the
    // same host, however weak that detection is (regression guard for the priority ordering bug
    // found while implementing the fix above).
    [Fact]
    public async Task DiscoverAsync_ShouldKeepTheRealDetection_WhenTheSameHostAlsoHasTheBaselineSignal()
    {
        using var listener = StartLoopbackListener();
        var port = PortOf(listener);

        using var stopServer = new CancellationTokenSource();
        var serverTask = Task.Run(async () =>
        {
            try
            {
                while (!stopServer.IsCancellationRequested)
                {
                    using var client = await listener.AcceptTcpClientAsync(stopServer.Token);
                    using var stream = client.GetStream();
                    var buffer = new byte[1024];
                    _ = await stream.ReadAsync(buffer, stopServer.Token);

                    var payload = "HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n";
                    var bytes = Encoding.UTF8.GetBytes(payload);
                    await stream.WriteAsync(bytes, stopServer.Token);
                    await stream.FlushAsync(stopServer.Token);
                }
            }
            catch (OperationCanceledException) { }
        });

        var sut = Discovery(HermeticSettings(httpPorts: [port]));

        var result = await sut.DiscoverAsync().ObservedAsync();
        stopServer.Cancel();
        await serverTask;

        var candidate = Assert.Single(result, item => item.Host == Loopback && item.Port == port);
        Assert.Equal("http_service", candidate.DiscoverySource);
    }

    // ADR-32: the "nmap" port sweep + fingerprint. An open port that passes the DVRIP fingerprint
    // (0xFF magic reply) surfaces the host as a confirmed camera with a Port|Protocol enrichment
    // row. Same mechanism that lets V380 be detected on its own port.
    [Fact]
    public async Task DiscoverAsync_ShouldConfirmTheCamera_WhenASweptPortPassesTheDvripFingerprint()
    {
        using var listener = StartLoopbackListener();
        var dvripPort = PortOf(listener);

        using var stopServer = new CancellationTokenSource();
        var serverTask = Task.Run(async () =>
        {
            try
            {
                while (!stopServer.IsCancellationRequested)
                {
                    using var client = await listener.AcceptTcpClientAsync(stopServer.Token);
                    using var stream = client.GetStream();
                    var buffer = new byte[128];
                    _ = await stream.ReadAsync(buffer, stopServer.Token);
                    // DVRIP fingerprint only checks the first byte is the 0xFF magic.
                    await stream.WriteAsync(new byte[] { 0xFF, 0x01, 0x00, 0x00 }, stopServer.Token);
                    await stream.FlushAsync(stopServer.Token);
                }
            }
            catch (OperationCanceledException) { }
            catch (System.Net.Sockets.SocketException) { }
        });

        var sut = Discovery(HermeticSettings(
            scanPorts: [dvripPort],
            portFingerprints: new Dictionary<int, SupportedProtocol> { [dvripPort] = SupportedProtocol.Dvrip }));

        var result = await sut.DiscoverAsync().ObservedAsync();
        stopServer.Cancel();
        await serverTask;

        var candidate = Assert.Single(result, item => item.Host == Loopback);
        Assert.Equal("camera_confirmed", candidate.Qualification);
        var port = Assert.Single(candidate.TechnicalDetails!.DetectedPorts);
        Assert.Equal(dvripPort, port.Port);
        Assert.Equal("DVRIP", port.Label);
        Assert.Equal("Dvrip", port.Protocol);
    }

    // ADR-32: an open port whose fingerprint fails is NOT mislabelled — it surfaces as an
    // "unidentified open port" (this is the Tapo-isn't-V380 fix). Here a dumb listener never
    // completes the V380 handshake, so it must show up unidentified, not as V380.
    [Fact]
    public async Task DiscoverAsync_ShouldShowAnUnidentifiedOpenPort_WhenTheV380FingerprintFails()
    {
        using var listener = StartLoopbackListener();
        var v380Port = PortOf(listener);

        using var stopServer = new CancellationTokenSource();
        var serverTask = Task.Run(async () =>
        {
            try
            {
                while (!stopServer.IsCancellationRequested)
                {
                    // Accept and immediately close — never speaks V380.
                    using var client = await listener.AcceptTcpClientAsync(stopServer.Token);
                }
            }
            catch (OperationCanceledException) { }
            catch (System.Net.Sockets.SocketException) { }
        });

        var sut = Discovery(HermeticSettings(
            scanPorts: [v380Port],
            portFingerprints: new Dictionary<int, SupportedProtocol> { [v380Port] = SupportedProtocol.V380 }));

        var result = await sut.DiscoverAsync().ObservedAsync();
        stopServer.Cancel();
        await serverTask;

        var candidate = Assert.Single(result, item => item.Host == Loopback);
        var port = Assert.Single(candidate.TechnicalDetails!.DetectedPorts);
        Assert.Equal(v380Port, port.Port);
        Assert.Equal("unknown", port.Protocol);
        Assert.Equal("non identifié", port.Label);
        // No protocol confirmed → not a camera.
        Assert.Equal("device_unknown", candidate.Qualification);
    }
}
