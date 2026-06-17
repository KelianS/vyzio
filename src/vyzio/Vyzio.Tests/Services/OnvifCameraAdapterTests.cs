using System.Net;
using System.Text;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Vyzio.Core.Entities;
using Vyzio.Infrastructure.VendorAdapters;

namespace Vyzio.Tests.Services;

public class OnvifCameraAdapterTests
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
        PtzSupported = true,
        PrivacyModeStrategy = "ptz_parking",
    };

    private static (OnvifCameraAdapter adapter, List<HttpRequestMessage> requests) MakeAdapter(
        HttpStatusCode status = HttpStatusCode.OK,
        string responseBody = "<s:Envelope/>"
    )
    {
        var captured = new List<HttpRequestMessage>();
        var handler = new CaptureHandler(captured, status, responseBody);
        var httpClient = new HttpClient(handler);
        var factory = Substitute.For<IHttpClientFactory>();
        factory.CreateClient("onvif").Returns(httpClient);
        var ptzClient = new OnvifPtzClient(factory, NullLogger<OnvifPtzClient>.Instance);
        var adapter = new OnvifCameraAdapter(ptzClient, NullLogger<OnvifCameraAdapter>.Instance);
        return (adapter, captured);
    }

    [Fact]
    public void VendorFamily_is_onvif()
    {
        var (adapter, _) = MakeAdapter();
        Assert.Equal("onvif", adapter.VendorFamily);
    }

    [Fact]
    public async Task SupportsPrivacyMode_returns_false()
    {
        var (adapter, _) = MakeAdapter();
        Assert.False(await adapter.SupportsPrivacyModeAsync(MakeCamera()));
    }

    [Fact]
    public async Task SupportsPtz_returns_true()
    {
        var (adapter, _) = MakeAdapter();
        Assert.True(await adapter.SupportsPtzAsync(MakeCamera()));
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
        var (adapter, requests) = MakeAdapter(responseBody: profilesXml);

        await adapter.PtzMoveAsync(MakeCamera(), PtzDirection.Up, speed: 80);

        Assert.Equal(2, requests.Count);
        var bodies = await ReadBodies(requests);
        Assert.Contains("GetProfiles", bodies[0]);
        Assert.Contains("ContinuousMove", bodies[1]);
        Assert.Contains("profile_1", bodies[1]);
    }

    [Fact]
    public async Task PtzStopAsync_sends_Stop_command()
    {
        var (adapter, requests) = MakeAdapter();

        await adapter.PtzStopAsync(MakeCamera());

        Assert.Equal(2, requests.Count); // GetProfiles + Stop
        var bodies = await ReadBodies(requests);
        Assert.Contains("Stop", bodies[1]);
    }

    [Theory]
    [InlineData(PtzDirection.Up, "0.00", "0.80")]
    [InlineData(PtzDirection.Down, "0.00", "-0.80")]
    [InlineData(PtzDirection.Left, "-0.80", "0.00")]
    [InlineData(PtzDirection.Right, "0.80", "0.00")]
    [InlineData(PtzDirection.UpLeft, "-0.80", "0.80")]
    [InlineData(PtzDirection.DownRight, "0.80", "-0.80")]
    public async Task PtzMove_maps_direction_to_correct_velocity(PtzDirection direction, string expectedPan, string expectedTilt)
    {
        var (adapter, requests) = MakeAdapter();

        await adapter.PtzMoveAsync(MakeCamera(), direction, speed: 80);

        var bodies = await ReadBodies(requests);
        var continuousMoveBody = bodies[1];
        Assert.Contains($"x=\"{expectedPan}\"", continuousMoveBody);
        Assert.Contains($"y=\"{expectedTilt}\"", continuousMoveBody);
    }

    private static async Task<List<string>> ReadBodies(List<HttpRequestMessage> requests)
    {
        var result = new List<string>();
        foreach (var r in requests)
        {
            if (r.Content is null) { result.Add(string.Empty); continue; }
            result.Add(await r.Content.ReadAsStringAsync());
        }
        return result;
    }

    private sealed class CaptureHandler(List<HttpRequestMessage> captured, HttpStatusCode status, string body)
        : HttpMessageHandler
    {
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            // Clone the content so it can be read after the request completes.
            if (request.Content is not null)
            {
                var clone = new StringContent(
                    await request.Content.ReadAsStringAsync(ct),
                    Encoding.UTF8,
                    request.Content.Headers.ContentType?.MediaType ?? "text/plain"
                );
                var cloned = new HttpRequestMessage(request.Method, request.RequestUri) { Content = clone };
                captured.Add(cloned);
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
}
