using System.Net;
using System.Text;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;
using NSubstitute;
using Vyzio.Core.Entities;
using Vyzio.Infrastructure.VendorAdapters;

namespace Vyzio.Tests.Services;

// Pins the two shapes met on hardware: one endpoint per service (V380) and one for all (Tapo) (ADR-56).
public sealed class OnvifEndpointResolverTests
{
    private const string DateAndTimeAnswer = """
        <s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope">
          <s:Body><GetSystemDateAndTimeResponse xmlns="http://www.onvif.org/ver10/device/wsdl"/></s:Body>
        </s:Envelope>
        """;

    private static string ServicesAnswer(string mediaXAddr, string ptzXAddr) => $"""
        <s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope">
          <s:Body>
            <GetServicesResponse xmlns="http://www.onvif.org/ver10/device/wsdl">
              <Service>
                <Namespace>http://www.onvif.org/ver10/media/wsdl</Namespace>
                <XAddr>{mediaXAddr}</XAddr>
              </Service>
              <Service>
                <Namespace>http://www.onvif.org/ver20/ptz/wsdl</Namespace>
                <XAddr>{ptzXAddr}</XAddr>
              </Service>
            </GetServicesResponse>
          </s:Body>
        </s:Envelope>
        """;

    private static Camera MakeCamera() => new()
    {
        Id = "cam1",
        Slug = "cam1",
        FrigateCameraName = "cam1",
        DisplayName = "Camera",
        Host = "192.168.1.10",
        Username = "user",
        Password = "pass",
    };

    private static (OnvifEndpointResolver resolver, List<Uri> calls) MakeResolver(
        Func<Uri, string, HttpResponseMessage> respond, TimeProvider? time = null)
    {
        var calls = new List<Uri>();
        var factory = Substitute.For<IHttpClientFactory>();
        factory.CreateClient("onvif").Returns(new HttpClient(new StubHandler(calls, respond)));
        return (new OnvifEndpointResolver(factory, time ?? TimeProvider.System, NullLogger<OnvifEndpointResolver>.Instance), calls);
    }

    private static HttpResponseMessage Soap(string body) => new(HttpStatusCode.OK)
    {
        Content = new StringContent(body, Encoding.UTF8, "application/soap+xml"),
    };

    [Fact]
    public async Task ResolveAsync_ShouldFindTheServiceOnItsRealPortAndPath_WhenTheyAreNotTheCommonConvention()
    {
        var (resolver, _) = MakeResolver((url, _) =>
            url.Port == 2020 && url.AbsolutePath == "/onvif/service"
                ? Soap(DateAndTimeAnswer)
                : new HttpResponseMessage(HttpStatusCode.NotFound));

        var endpoint = await resolver.ResolveAsync(MakeCamera(), CancellationToken.None);

        Assert.NotNull(endpoint);
        Assert.Equal("http://192.168.1.10:2020/onvif/service", endpoint!.DeviceServiceUrl.ToString());
    }

    [Fact]
    public async Task ResolveAsync_ShouldAddressEveryServiceAtTheDeviceUrl_WhenTheCameraAnnouncesNoXAddr()
    {
        var (resolver, _) = MakeResolver((url, _) =>
            url.AbsolutePath == "/onvif/service"
                ? Soap(DateAndTimeAnswer)
                : new HttpResponseMessage(HttpStatusCode.NotFound));

        var endpoint = await resolver.ResolveAsync(MakeCamera(), CancellationToken.None);

        Assert.NotNull(endpoint);
        Assert.Equal(endpoint!.DeviceServiceUrl, endpoint.UrlFor(OnvifService.Ptz));
        Assert.Equal(endpoint.DeviceServiceUrl, endpoint.UrlFor(OnvifService.Imaging));
    }

    [Fact]
    public async Task ResolveAsync_ShouldUseTheAnnouncedAddress_WhenTheCameraSplitsItsServicesPerPath()
    {
        var (resolver, _) = MakeResolver((url, body) =>
        {
            if (url.AbsolutePath != "/onvif/device_service") return new HttpResponseMessage(HttpStatusCode.NotFound);
            return Soap(body.Contains("GetServices")
                ? ServicesAnswer("http://192.168.1.10/onvif/media_service", "http://192.168.1.10/onvif/ptz_service")
                : DateAndTimeAnswer);
        });

        var endpoint = await resolver.ResolveAsync(MakeCamera(), CancellationToken.None);

        Assert.NotNull(endpoint);
        Assert.Equal("/onvif/ptz_service", endpoint!.UrlFor(OnvifService.Ptz).AbsolutePath);
        Assert.Equal("/onvif/media_service", endpoint.UrlFor(OnvifService.Media).AbsolutePath);
    }

    [Fact]
    public async Task ResolveAsync_ShouldKeepTheHostItReachedTheCameraOn_WhenTheAnnouncedAddressNamesAnother()
    {
        var (resolver, _) = MakeResolver((url, body) =>
        {
            if (url.AbsolutePath != "/onvif/device_service") return new HttpResponseMessage(HttpStatusCode.NotFound);
            return Soap(body.Contains("GetServices")
                ? ServicesAnswer("http://10.0.0.1/onvif/media_service", "http://10.0.0.1/onvif/ptz_service")
                : DateAndTimeAnswer);
        });

        var endpoint = await resolver.ResolveAsync(MakeCamera(), CancellationToken.None);

        Assert.Equal("192.168.1.10", endpoint!.UrlFor(OnvifService.Ptz).Host);
    }

    [Fact]
    public async Task ResolveAsync_ShouldSendNoCredentials_WhenSweepingForTheEndpoint()
    {
        var envelopes = new List<string>();
        var (resolver, _) = MakeResolver((url, body) =>
        {
            envelopes.Add(body);
            return url.AbsolutePath == "/onvif/service" && !body.Contains("GetServices")
                ? Soap(DateAndTimeAnswer)
                : new HttpResponseMessage(HttpStatusCode.NotFound);
        });

        await resolver.ResolveAsync(MakeCamera(), CancellationToken.None);

        var sweep = envelopes.Where(envelope => envelope.Contains("GetSystemDateAndTime")).ToList();
        Assert.NotEmpty(sweep);
        Assert.All(sweep, envelope => Assert.DoesNotContain("UsernameToken", envelope));
    }

    [Fact]
    public async Task ResolveAsync_ShouldPersistTheAddressOnTheCamera_WhenTheSweepSucceeds()
    {
        var (resolver, _) = MakeResolver((url, _) =>
            url.Port == 2020 && url.AbsolutePath == "/onvif/service"
                ? Soap(DateAndTimeAnswer)
                : new HttpResponseMessage(HttpStatusCode.NotFound));
        var camera = MakeCamera();

        await resolver.ResolveAsync(camera, CancellationToken.None);

        Assert.Equal("http://192.168.1.10:2020/onvif/service", camera.GetProtocolEndpoint(SupportedProtocol.Onvif));
    }

    [Fact]
    public async Task ResolveAsync_ShouldNotSweep_WhenTheCameraAlreadyCarriesAResolvedAddress()
    {
        var (resolver, calls) = MakeResolver((_, _) => Soap(DateAndTimeAnswer));
        var camera = MakeCamera();
        camera.SetProtocolEndpoint(SupportedProtocol.Onvif, "http://192.168.1.10:2020/onvif/service");

        var endpoint = await resolver.ResolveAsync(camera, CancellationToken.None);

        Assert.Equal("http://192.168.1.10:2020/onvif/service", endpoint!.DeviceServiceUrl.ToString());
        Assert.Single(calls); // GetServices only, no port sweep
    }

    [Fact]
    public async Task ResolveAsync_ShouldReturnNull_WhenNoPortAnswersOnvif()
    {
        var (resolver, _) = MakeResolver((_, _) => new HttpResponseMessage(HttpStatusCode.NotFound));

        Assert.Null(await resolver.ResolveAsync(MakeCamera(), CancellationToken.None));
    }

    [Fact]
    public async Task ResolveAsync_ShouldRecogniseTheService_WhenItRefusesTheUnauthenticatedProbe()
    {
        var (resolver, _) = MakeResolver((url, _) =>
        {
            if (url.Port != 2020) return new HttpResponseMessage(HttpStatusCode.NotFound);
            var refused = new HttpResponseMessage(HttpStatusCode.Unauthorized);
            refused.Headers.WwwAuthenticate.ParseAdd("Digest realm=\"ONVIF\", nonce=\"n\"");
            return refused;
        });

        var endpoint = await resolver.ResolveAsync(MakeCamera(), CancellationToken.None);

        Assert.NotNull(endpoint);
        Assert.Equal(2020, endpoint!.DeviceServiceUrl.Port);
    }

    [Fact]
    public async Task ResolveAsync_ShouldNotSweepAgain_WhenTheLastSweepFoundNothingMomentsAgo()
    {
        var time = new FakeTimeProvider();
        var (resolver, calls) = MakeResolver((_, _) => new HttpResponseMessage(HttpStatusCode.NotFound), time);
        await resolver.ResolveAsync(MakeCamera(), CancellationToken.None);
        var sweep = calls.Count;

        time.Advance(TimeSpan.FromMinutes(4));
        await resolver.ResolveAsync(MakeCamera(), CancellationToken.None);

        Assert.Equal(sweep, calls.Count);
    }

    [Fact]
    public async Task ResolveAsync_ShouldSweepAgain_WhenTheCooldownAfterAFailedSweepHasPassed()
    {
        var time = new FakeTimeProvider();
        var (resolver, calls) = MakeResolver((_, _) => new HttpResponseMessage(HttpStatusCode.NotFound), time);
        await resolver.ResolveAsync(MakeCamera(), CancellationToken.None);
        var sweep = calls.Count;

        time.Advance(TimeSpan.FromMinutes(6));
        await resolver.ResolveAsync(MakeCamera(), CancellationToken.None);

        Assert.Equal(2 * sweep, calls.Count);
    }

    private sealed class StubHandler(List<Uri> calls, Func<Uri, string, HttpResponseMessage> respond) : HttpMessageHandler
    {
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            calls.Add(request.RequestUri!);
            var body = request.Content is null ? string.Empty : await request.Content.ReadAsStringAsync(ct);
            return respond(request.RequestUri!, body);
        }
    }
}
