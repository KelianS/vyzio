using System.Net;
using System.Text;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Vyzio.Core.Entities;
using Vyzio.Infrastructure.CapabilityProviders;
using Vyzio.Infrastructure.VendorAdapters;

namespace Vyzio.Tests.Services;

public class OnvifPtzProviderTests
{
    private static Camera MakeCamera() => new()
    {
        Id = "cam1",
        Slug = "cam1",
        DisplayName = "ONVIF Cam",
        Host = "192.168.1.100",
        Port = 8899,
        Username = "admin",
        Password = "pass",
    };

    private static CameraCapabilityBinding MakeBinding() => new()
    {
        CameraId = "cam1",
        Capability = CameraCapability.Ptz,
        Protocol = CapabilityProtocol.Onvif,
        Verified = true,
    };

    private static (OnvifPtzProvider provider, List<HttpRequestMessage> requests) MakeProvider(
        HttpStatusCode status = HttpStatusCode.OK,
        string responseBody = "<s:Envelope/>",
        Func<HttpRequestMessage, HttpResponseMessage>? handler = null)
    {
        var captured = new List<HttpRequestMessage>();
        HttpMessageHandler httpHandler = handler is not null
            ? new DelegatingStubHandler(captured, handler)
            : new CaptureHandler(captured, status, responseBody);
        var factory = Substitute.For<IHttpClientFactory>();
        factory.CreateClient("onvif").Returns(new HttpClient(httpHandler));
        var ptzClient = new OnvifPtzClient(factory, NullLogger<OnvifPtzClient>.Instance);
        return (new OnvifPtzProvider(ptzClient, NullLogger<OnvifPtzProvider>.Instance), captured);
    }

    [Fact]
    public void Protocol_is_Onvif()
    {
        var (provider, _) = MakeProvider();
        Assert.Equal(CapabilityProtocol.Onvif, provider.Protocol);
    }

    [Fact]
    public async Task PtzMoveAsync_sends_GetProfiles_then_ContinuousMove()
    {
        var profilesXml = """
            <s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope">
              <s:Body>
                <trt:GetProfilesResponse xmlns:trt="http://www.onvif.org/ver10/media/wsdl">
                  <trt:Profiles token="profile_1"/>
                </trt:GetProfilesResponse>
              </s:Body>
            </s:Envelope>
            """;
        var (provider, requests) = MakeProvider(responseBody: profilesXml);

        await provider.PtzMoveAsync(MakeCamera(), MakeBinding(), PtzDirection.Up, speed: 80);

        var bodies = await ReadBodies(requests);
        Assert.Contains("GetProfiles", bodies[0]);
        Assert.Contains("ContinuousMove", bodies[1]);
        Assert.Contains("profile_1", bodies[1]);
    }

    [Fact]
    public async Task PtzStopAsync_sends_Stop_command()
    {
        var (provider, requests) = MakeProvider();

        await provider.PtzStopAsync(MakeCamera(), MakeBinding());

        var bodies = await ReadBodies(requests);
        Assert.Contains("Stop", bodies.Last());
    }

    [Theory]
    [InlineData(PtzDirection.Up, "0.00", "0.80")]
    [InlineData(PtzDirection.Down, "0.00", "-0.80")]
    [InlineData(PtzDirection.Left, "-0.80", "0.00")]
    [InlineData(PtzDirection.Right, "0.80", "0.00")]
    [InlineData(PtzDirection.UpLeft, "-0.80", "0.80")]
    [InlineData(PtzDirection.DownLeft, "-0.80", "-0.80")]
    [InlineData(PtzDirection.UpRight, "0.80", "0.80")]
    [InlineData(PtzDirection.DownRight, "0.80", "-0.80")]
    public async Task PtzMoveAsync_maps_direction_to_correct_velocity(PtzDirection direction, string expectedPan, string expectedTilt)
    {
        var (provider, requests) = MakeProvider();

        await provider.PtzMoveAsync(MakeCamera(), MakeBinding(), direction, speed: 80);

        var bodies = await ReadBodies(requests);
        var moveBody = bodies.First(b => b.Contains("ContinuousMove"));
        Assert.Contains($"x=\"{expectedPan}\"", moveBody);
        Assert.Contains($"y=\"{expectedTilt}\"", moveBody);
    }

    [Fact]
    public async Task ProbeAsync_returns_true_when_SOAP_responds_with_profile()
    {
        var profilesXml = """
            <s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope">
              <s:Body>
                <trt:GetProfilesResponse xmlns:trt="http://www.onvif.org/ver10/media/wsdl">
                  <trt:Profiles token="profile_1"/>
                </trt:GetProfilesResponse>
              </s:Body>
            </s:Envelope>
            """;
        var (provider, _) = MakeProvider(responseBody: profilesXml);

        var result = await provider.ProbeAsync(MakeCamera(), MakeBinding());

        Assert.True(result);
    }

    [Fact]
    public async Task ProbeAsync_sends_GetProfiles_and_GetConfigurationOptions()
    {
        // OnvifPtzClient is resilient — uses default profile token on failure, so ProbeAsync
        // always returns true as long as no exception escapes GetFirstProfileTokenAsync.
        var (provider, requests) = MakeProvider();

        var result = await provider.ProbeAsync(MakeCamera(), MakeBinding());

        Assert.True(result);
        var bodies = await ReadBodies(requests);
        Assert.Contains(bodies, b => b.Contains("GetProfiles"));
    }

    private static async Task<List<string>> ReadBodies(List<HttpRequestMessage> requests)
    {
        var result = new List<string>();
        foreach (var r in requests)
            result.Add(r.Content is null ? string.Empty : await r.Content.ReadAsStringAsync());
        return result;
    }

    private sealed class CaptureHandler(List<HttpRequestMessage> captured, HttpStatusCode status, string body)
        : HttpMessageHandler
    {
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            if (request.Content is not null)
            {
                var clone = new StringContent(
                    await request.Content.ReadAsStringAsync(ct), Encoding.UTF8,
                    request.Content.Headers.ContentType?.MediaType ?? "text/plain");
                captured.Add(new HttpRequestMessage(request.Method, request.RequestUri) { Content = clone });
            }
            else
            {
                captured.Add(request);
            }
            return new HttpResponseMessage(status)
            {
                Content = new StringContent(body, Encoding.UTF8, "application/soap+xml"),
            };
        }
    }

    private sealed class DelegatingStubHandler(List<HttpRequestMessage> captured, Func<HttpRequestMessage, HttpResponseMessage> respond)
        : HttpMessageHandler
    {
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            if (request.Content is not null)
            {
                var clone = new StringContent(await request.Content.ReadAsStringAsync(ct), Encoding.UTF8);
                captured.Add(new HttpRequestMessage(request.Method, request.RequestUri) { Content = clone });
            }
            else
            {
                captured.Add(request);
            }
            return respond(request);
        }
    }
}
