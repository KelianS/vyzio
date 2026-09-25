using System.Collections.Concurrent;
using System.Net;
using System.Text;
using System.Xml.Linq;
using Microsoft.Extensions.Logging;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.Services.CameraDiscovery;

namespace Vyzio.Infrastructure.VendorAdapters;

// An enum, so a caller cannot ask for a service that does not exist (type-safe comparisons).
internal enum OnvifService
{
    Device,
    Media,
    Ptz,
    Imaging,
}

// A service the device did not announce is addressed at DeviceServiceUrl: single-endpoint firmwares (ADR-56).
internal sealed record OnvifEndpoint(Uri DeviceServiceUrl, IReadOnlyDictionary<OnvifService, Uri> ServiceUrls)
{
    public Uri UrlFor(OnvifService service)
        => ServiceUrls.GetValueOrDefault(service, DeviceServiceUrl);
}

// Asks the camera where it serves ONVIF instead of assuming it; the cascade is in docs/design/onvif.md (ADR-56).
internal sealed class OnvifEndpointResolver(
    IHttpClientFactory httpClientFactory,
    TimeProvider time,
    ILogger<OnvifEndpointResolver> logger)
    : ICameraProtocolEndpointCache
{
    private static readonly TimeSpan ProbeTimeout = TimeSpan.FromMilliseconds(1500);

    // Without it, every call on a camera that does not speak ONVIF would re-sweep the whole port list.
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
            && time.GetUtcNow() - lastFailure < FailureCooldown)
        {
            return null;
        }

        var gate = _locks.GetOrAdd(camera.Id, _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync(ct);
        try
        {
            if (_cache.TryGetValue(camera.Id, out cached))
                return cached;

            // Checked again once in: callers queued behind a failed sweep must not each sweep again.
            if (_failedAt.TryGetValue(camera.Id, out lastFailure)
                && time.GetUtcNow() - lastFailure < FailureCooldown)
            {
                return null;
            }

            var deviceUrl = await FindDeviceServiceAsync(camera, ct);
            if (deviceUrl is null)
            {
                // A caller that gave up has learnt nothing about the camera.
                ct.ThrowIfCancellationRequested();
                _failedAt[camera.Id] = time.GetUtcNow();
                logger.LogWarning("No ONVIF service answered on {Host} (ports {Ports}).",
                    camera.Host, string.Join(", ", DiscoveryPortCatalog.OnvifPorts));
                return null;
            }

            var announced = await ReadAnnouncedServicesAsync(camera, deviceUrl, ct);
            var services = announced ?? new Dictionary<OnvifService, Uri>();
            var endpoint = new OnvifEndpoint(deviceUrl, services);
            // Kept only once the camera said which services it has; a lost answer is asked again next call.
            if (announced is not null) _cache[camera.Id] = endpoint;
            _failedAt.TryRemove(camera.Id, out _);

            // Written on the entity; the use case owning the transaction saves it (ADR-56).
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

    // Only through CameraEndpointForgetting, with the camera's row: one half alone keeps the stale one.
    public void Forget(string cameraId)
    {
        _cache.TryRemove(cameraId, out _);
        _failedAt.TryRemove(cameraId, out _);
    }

    private async Task<Uri?> FindDeviceServiceAsync(Camera camera, CancellationToken ct)
    {
        // Taken as-is: only a real resolution writes it, and a stale one surfaces as a failed call (ADR-56).
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
        using var timeout = new CancellationTokenSource(ProbeTimeout, time);
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(ct, timeout.Token);
        try
        {
            var http = httpClientFactory.CreateClient("onvif");
            var content = new StringContent(OnvifServiceProbe.CredentialFreeEnvelope, Encoding.UTF8, "application/soap+xml");
            using var response = await http.PostAsync(url, content, linked.Token);
            var body = await response.Content.ReadAsStringAsync(linked.Token);
            return OnvifServiceProbe.Identifies((int)response.StatusCode, response.Headers.WwwAuthenticate.ToString(), body);
        }
        catch (Exception ex)
        {
            logger.LogTrace("ONVIF probe on {Url} did not answer: {Message}.", url, ex.Message);
            return false;
        }
    }

    // An empty answer is not a failure: every service then resolves to the device service URL.
    // Null when the camera gave no usable answer, empty when it announced nothing: only the latter is final.
    private async Task<IReadOnlyDictionary<OnvifService, Uri>?> ReadAnnouncedServicesAsync(Camera camera, Uri deviceUrl, CancellationToken ct)
    {
        const string body = """<GetServices xmlns="http://www.onvif.org/ver10/device/wsdl"><IncludeCapability>false</IncludeCapability></GetServices>""";

        // Pre-authentication first (ONVIF core); the camera's own account only if it insists, never a guess.
        var xml = await PostGetServicesAsync(deviceUrl, OnvifEnvelope.Anonymous(body), ct);
        if (xml is { Unauthorized: true } && !string.IsNullOrWhiteSpace(camera.Username))
            xml = await PostGetServicesAsync(deviceUrl, OnvifEnvelope.Build(camera.Username, camera.Password ?? string.Empty, body), ct);

        if (xml is not { Unauthorized: false, Body: { } answer })
        {
            logger.LogDebug("ONVIF GetServices gave no usable answer on {Url}; every service uses the device address for now.", deviceUrl);
            return null;
        }

        var announced = new Dictionary<OnvifService, Uri>();
        try
        {
            foreach (var element in XDocument.Parse(answer).Descendants().Where(e => e.Name.LocalName == "Service"))
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
            return null;
        }

        return announced;
    }

    private sealed record GetServicesAnswer(bool Unauthorized, string? Body);

    // Null on silence or transport failure; otherwise whether the camera demanded credentials, and its body when it answered.
    private async Task<GetServicesAnswer?> PostGetServicesAsync(Uri deviceUrl, string envelope, CancellationToken ct)
    {
        using var timeout = new CancellationTokenSource(ProbeTimeout, time);
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(ct, timeout.Token);
        try
        {
            var http = httpClientFactory.CreateClient("onvif");
            using var response = await http.PostAsync(deviceUrl, new StringContent(envelope, Encoding.UTF8, "application/soap+xml"), linked.Token);
            if (response.StatusCode == HttpStatusCode.Unauthorized) return new GetServicesAnswer(Unauthorized: true, Body: null);
            if (!response.IsSuccessStatusCode) return new GetServicesAnswer(Unauthorized: false, Body: null);
            return new GetServicesAnswer(Unauthorized: false, Body: await response.Content.ReadAsStringAsync(linked.Token));
        }
        catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
        {
            logger.LogDebug("ONVIF GetServices on {Url} did not answer ({Message}).", deviceUrl, ex.Message);
            return null;
        }
    }

    // A camera behind NAT announces its own idea of its address: keep its path, keep the host we reached.
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
