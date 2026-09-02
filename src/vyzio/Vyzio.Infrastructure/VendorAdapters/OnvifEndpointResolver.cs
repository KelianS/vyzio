using System.Collections.Concurrent;
using System.Net;
using System.Text;
using System.Xml.Linq;
using Microsoft.Extensions.Logging;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.Services.CameraDiscovery;

namespace Vyzio.Infrastructure.VendorAdapters;

// The four ONVIF services Vyzio speaks. An enum rather than the service name in a string, so a
// caller cannot ask for a service that does not exist (backend golden rule, type-safe comparisons).
internal enum OnvifService
{
    Device,
    Media,
    Ptz,
    Imaging,
}

// Where one camera serves ONVIF. ServiceUrls holds what the device announced through GetServices;
// a service missing from it is addressed at DeviceServiceUrl, which is what makes a firmware
// exposing every service on one endpoint work without being named (ADR-56).
internal sealed record OnvifEndpoint(Uri DeviceServiceUrl, IReadOnlyDictionary<OnvifService, Uri> ServiceUrls)
{
    public Uri UrlFor(OnvifService service)
        => ServiceUrls.GetValueOrDefault(service, DeviceServiceUrl);
}

// Finds where a camera serves ONVIF instead of assuming a port and a path (ADR-56). Resolution is
// persisted endpoint, then a sweep of the catalogue ports crossed with the candidate paths, then
// the per-service XAddr the device itself announces. Registered as Singleton: the in-memory cache
// is what keeps the sweep to once per camera. Persistence is the use-case layer's job.
internal sealed class OnvifEndpointResolver(IHttpClientFactory httpClientFactory, ILogger<OnvifEndpointResolver> logger)
    : ICameraProtocolEndpointCache
{
    private static readonly TimeSpan ProbeTimeout = TimeSpan.FromMilliseconds(1500);

    // A camera that does not speak ONVIF is asked again only after this delay: without it, every
    // call on a DVRIP-only or V380-only camera would re-sweep the whole port list.
    private static readonly TimeSpan FailureCooldown = TimeSpan.FromMinutes(5);

    private readonly ConcurrentDictionary<string, OnvifEndpoint> _cache = new();
    private readonly ConcurrentDictionary<string, DateTimeOffset> _failedAt = new();
    private readonly ConcurrentDictionary<string, SemaphoreSlim> _locks = new();

    // Returns the resolved endpoint, or null when no ONVIF service answered on this camera.
    public async Task<OnvifEndpoint?> ResolveAsync(Camera camera, CancellationToken ct)
    {
        if (_cache.TryGetValue(camera.Id, out var cached))
            return cached;

        if (_failedAt.TryGetValue(camera.Id, out var lastFailure)
            && DateTimeOffset.UtcNow - lastFailure < FailureCooldown)
        {
            return null;
        }

        var gate = _locks.GetOrAdd(camera.Id, _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync(ct);
        try
        {
            if (_cache.TryGetValue(camera.Id, out cached))
                return cached;

            var deviceUrl = await FindDeviceServiceAsync(camera, ct);
            if (deviceUrl is null)
            {
                _failedAt[camera.Id] = DateTimeOffset.UtcNow;
                logger.LogWarning("No ONVIF service answered on {Host} (ports {Ports}).",
                    camera.Host, string.Join(", ", DiscoveryPortCatalog.OnvifPorts));
                return null;
            }

            var services = await ReadAnnouncedServicesAsync(camera, deviceUrl, ct);
            var endpoint = new OnvifEndpoint(deviceUrl, services);
            _cache[camera.Id] = endpoint;
            _failedAt.TryRemove(camera.Id, out _);

            // Written on the entity, not saved here: the use case that owns the transaction persists
            // it, the way the V380 device id is (ADR-56).
            camera.SetProtocolEndpoint(SupportedProtocol.Onvif, deviceUrl.ToString());
            logger.LogInformation("ONVIF resolved for {Host}: {Url} ({Count} service address(es) announced).",
                camera.Host, deviceUrl, services.Count);
            return endpoint;
        }
        finally
        {
            gate.Release();
        }
    }

    // Drops what was resolved for this camera. Paired with Camera.ClearProtocolEndpoints by the use
    // case: forgetting only one of the two would leave the stale half in charge.
    public void Forget(string cameraId)
    {
        _cache.TryRemove(cameraId, out _);
        _failedAt.TryRemove(cameraId, out _);
    }

    private async Task<Uri?> FindDeviceServiceAsync(Camera camera, CancellationToken ct)
    {
        // A persisted address is taken as-is, without a probe: it is only ever written after a real
        // resolution, and re-verifying it would cost a round trip on every process start. A stale one
        // surfaces as a failed call, and Forget puts the camera back through the sweep.
        if (camera.GetProtocolEndpoint(SupportedProtocol.Onvif) is { } persisted
            && Uri.TryCreate(persisted, UriKind.Absolute, out var persistedUrl))
        {
            return persistedUrl;
        }

        foreach (var port in DiscoveryPortCatalog.OnvifPorts)
        {
            foreach (var path in DiscoveryPortCatalog.OnvifPaths)
            {
                if (ct.IsCancellationRequested) return null;

                var candidate = new Uri($"http://{camera.Host}:{port}{path}");
                if (await AnswersOnvifAsync(candidate, ct))
                    return candidate;
            }
        }

        return null;
    }

    private async Task<bool> AnswersOnvifAsync(Uri url, CancellationToken ct)
    {
        using var timeout = new CancellationTokenSource(ProbeTimeout);
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(ct, timeout.Token);
        try
        {
            var http = httpClientFactory.CreateClient("onvif");
            var content = new StringContent(OnvifServiceProbe.CredentialFreeEnvelope, Encoding.UTF8, "application/soap+xml");
            using var response = await http.PostAsync(url, content, linked.Token);
            var body = await response.Content.ReadAsStringAsync(linked.Token);

            // A 401 still identifies an ONVIF service: the endpoint is right, only this unauthenticated
            // probe is refused, and the real calls carry credentials.
            if (response.StatusCode == HttpStatusCode.Unauthorized)
                return body.Contains("onvif", StringComparison.OrdinalIgnoreCase)
                    || (response.Headers.WwwAuthenticate.ToString().Contains("onvif", StringComparison.OrdinalIgnoreCase));

            return response.IsSuccessStatusCode && OnvifServiceProbe.LooksLikeOnvif(body);
        }
        catch (Exception ex)
        {
            logger.LogTrace("ONVIF probe on {Url} did not answer: {Message}.", url, ex.Message);
            return false;
        }
    }

    // Reads the per-service addresses the device announces. An empty result is not a failure: every
    // service then resolves to the device service URL.
    private async Task<IReadOnlyDictionary<OnvifService, Uri>> ReadAnnouncedServicesAsync(Camera camera, Uri deviceUrl, CancellationToken ct)
    {
        const string body = """<GetServices xmlns="http://www.onvif.org/ver10/device/wsdl"><IncludeCapability>false</IncludeCapability></GetServices>""";

        using var timeout = new CancellationTokenSource(ProbeTimeout);
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(ct, timeout.Token);

        string xml;
        try
        {
            var http = httpClientFactory.CreateClient("onvif");
            var envelope = OnvifEnvelope.Build(camera.Username ?? "admin", camera.Password ?? string.Empty, body);
            var content = new StringContent(envelope, Encoding.UTF8, "application/soap+xml");
            using var response = await http.PostAsync(deviceUrl, content, linked.Token);
            if (!response.IsSuccessStatusCode) return new Dictionary<OnvifService, Uri>();
            xml = await response.Content.ReadAsStringAsync(linked.Token);
        }
        catch (Exception ex)
        {
            logger.LogDebug("ONVIF GetServices unavailable on {Url} ({Message}), every service uses the device address.", deviceUrl, ex.Message);
            return new Dictionary<OnvifService, Uri>();
        }

        var announced = new Dictionary<OnvifService, Uri>();
        try
        {
            foreach (var element in XDocument.Parse(xml).Descendants().Where(e => e.Name.LocalName == "Service"))
            {
                var ns = element.Elements().FirstOrDefault(e => e.Name.LocalName == "Namespace")?.Value;
                var addr = element.Elements().FirstOrDefault(e => e.Name.LocalName == "XAddr")?.Value;
                if (ns is null || addr is null) continue;
                if (ServiceOfNamespace(ns) is not { } service) continue;
                if (Uri.TryCreate(addr, UriKind.Absolute, out var parsed))
                    announced[service] = RebaseOnCameraHost(parsed, deviceUrl);
            }
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "ONVIF GetServices answer unreadable for {Host}.", camera.Host);
        }

        return announced;
    }

    // Cameras behind NAT or renamed on the network announce an XAddr built from their own idea of
    // their address, keep the announced path, keep the host we actually reached them on.
    private static Uri RebaseOnCameraHost(Uri announced, Uri deviceUrl)
        => new UriBuilder(announced) { Host = deviceUrl.Host, Port = deviceUrl.Port }.Uri;

    private static OnvifService? ServiceOfNamespace(string ns) => ns switch
    {
        "http://www.onvif.org/ver10/device/wsdl" => OnvifService.Device,
        "http://www.onvif.org/ver10/media/wsdl" => OnvifService.Media,
        "http://www.onvif.org/ver20/ptz/wsdl" => OnvifService.Ptz,
        "http://www.onvif.org/ver20/imaging/wsdl" => OnvifService.Imaging,
        _ => null,
    };
}
