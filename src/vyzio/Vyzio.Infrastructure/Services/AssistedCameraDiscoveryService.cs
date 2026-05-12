using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Xml.Linq;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.Services;

public sealed class AssistedCameraDiscoveryService : ICameraDiscoveryService
{
    private static readonly IPAddress DiscoveryAddress = IPAddress.Parse("239.255.255.250");
    private static readonly IPEndPoint DiscoveryEndpoint = new(DiscoveryAddress, 3702);

    public async Task<IReadOnlyList<CameraDiscoveryCandidate>> DiscoverAsync(CancellationToken ct = default)
    {
        var candidates = new Dictionary<string, CameraDiscoveryCandidate>(StringComparer.OrdinalIgnoreCase);

        foreach (var candidate in await DiscoverOnvifCandidatesAsync(ct))
        {
            candidates[$"{candidate.Host}:{candidate.Port}:{candidate.StreamPath}"] = candidate;
        }

        foreach (var candidate in await DiscoverKnownRtspCandidatesAsync(ct))
        {
            candidates[$"{candidate.Host}:{candidate.Port}:{candidate.StreamPath}"] = candidate;
        }

        return candidates.Values
            .OrderBy(candidate => candidate.DisplayName, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private static async Task<IReadOnlyList<CameraDiscoveryCandidate>> DiscoverOnvifCandidatesAsync(CancellationToken ct)
    {
        var results = new List<CameraDiscoveryCandidate>();
        using var udpClient = new UdpClient(AddressFamily.InterNetwork)
        {
            EnableBroadcast = true,
            MulticastLoopback = false,
        };

        var probePayload = Encoding.UTF8.GetBytes(BuildProbeEnvelope());
        await udpClient.SendAsync(probePayload, probePayload.Length, DiscoveryEndpoint);

        var deadline = DateTimeOffset.UtcNow.AddSeconds(2);

        while (DateTimeOffset.UtcNow < deadline && !ct.IsCancellationRequested)
        {
            var receiveTask = udpClient.ReceiveAsync(ct).AsTask();
            var remaining = deadline - DateTimeOffset.UtcNow;
            if (remaining <= TimeSpan.Zero)
            {
                break;
            }

            var completed = await Task.WhenAny(receiveTask, Task.Delay(remaining, ct));
            if (completed != receiveTask)
            {
                break;
            }

            UdpReceiveResult response;

            try
            {
                response = await receiveTask;
            }
            catch
            {
                break;
            }

            var responseText = Encoding.UTF8.GetString(response.Buffer);
            foreach (var candidate in ParseOnvifCandidates(responseText))
            {
                results.Add(candidate);
            }
        }

        return results;
    }

    private static IEnumerable<CameraDiscoveryCandidate> ParseOnvifCandidates(string xml)
    {
        XDocument document;

        try
        {
            document = XDocument.Parse(xml);
        }
        catch
        {
            yield break;
        }

        var xAddresses = document.Descendants().Where(node => node.Name.LocalName == "XAddrs");
        foreach (var xAddress in xAddresses)
        {
            var values = xAddress.Value
                .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

            foreach (var value in values)
            {
                if (!Uri.TryCreate(value, UriKind.Absolute, out var uri))
                {
                    continue;
                }

                yield return new CameraDiscoveryCandidate(
                    ToDisplayName(uri.Host),
                    uri.Host,
                    554,
                    "onvif",
                    null,
                    "onvif",
                    $"ONVIF device announced via {uri.Host}:{uri.Port}.");
            }
        }
    }

    private static async Task<IReadOnlyList<CameraDiscoveryCandidate>> DiscoverKnownRtspCandidatesAsync(CancellationToken ct)
    {
        var probes = new (string Host, int Port, string StreamPath, string DisplayName, string Note)[]
        {
            ("127.0.0.1", 8554, "/test-camera", "Camera locale mock", "RTSP relay detected on the local mock stream."),
            ("localhost", 8554, "/test-camera", "Camera locale mock", "RTSP relay detected on the local mock stream."),
            ("mediamtx", 8554, "/test-camera", "Camera mock Docker", "RTSP relay detected on the Docker mock stream."),
        };

        var results = new List<CameraDiscoveryCandidate>();

        foreach (var probe in probes)
        {
            if (await CanConnectAsync(probe.Host, probe.Port, ct))
            {
                results.Add(new CameraDiscoveryCandidate(
                    probe.DisplayName,
                    probe.Host,
                    probe.Port,
                    "rtsp_manual",
                    probe.StreamPath,
                    "rtsp_probe",
                    probe.Note));
            }
        }

        return results;
    }

    private static async Task<bool> CanConnectAsync(string host, int port, CancellationToken ct)
    {
        try
        {
            using var client = new TcpClient();
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(TimeSpan.FromMilliseconds(250));
            await client.ConnectAsync(host, port, timeout.Token);
            return true;
        }
        catch
        {
            return false;
        }
    }

    private static string BuildProbeEnvelope() =>
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>" +
        "<e:Envelope xmlns:e=\"http://www.w3.org/2003/05/soap-envelope\" xmlns:w=\"http://schemas.xmlsoap.org/ws/2004/08/addressing\" xmlns:d=\"http://schemas.xmlsoap.org/ws/2005/04/discovery\" xmlns:dn=\"http://www.onvif.org/ver10/network/wsdl\">" +
        "<e:Header>" +
        $"<w:MessageID>uuid:{Guid.NewGuid():D}</w:MessageID>" +
        "<w:To>urn:schemas-xmlsoap-org:ws:2005:04:discovery</w:To>" +
        "<w:Action>http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</w:Action>" +
        "</e:Header>" +
        "<e:Body><d:Probe><d:Types>dn:NetworkVideoTransmitter</d:Types></d:Probe></e:Body>" +
        "</e:Envelope>";

    private static string ToDisplayName(string host)
        => host.Replace('-', ' ').Replace('_', ' ');
}