using System.Net;
using System.Text;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;
using NSubstitute;
using Vyzio.Core.Common;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.CapabilityProviders;
using Vyzio.Infrastructure.VendorAdapters;

namespace Vyzio.Tests.Services;

public class OnvifPtzProviderTests
{
    // A resolved address, so these tests exercise the provider, not the sweep (ADR-56).
    private static Camera MakeCamera()
    {
        var camera = new Camera
        {
            Id = "cam1",
            Slug = "cam1",
            FrigateCameraName = "cam1",
            DisplayName = "ONVIF Cam",
            Host = "192.168.1.100",
            Port = 8899,
            Username = "admin",
            Password = "pass",
        };
        camera.SetProtocolEndpoint(SupportedProtocol.Onvif, "http://192.168.1.100:8899/onvif/device_service");
        return camera;
    }

    private static CameraCapabilityBinding MakeBinding() => new()
    {
        CameraId = "cam1",
        Capability = CameraCapability.Ptz,
        Protocol = SupportedProtocol.Onvif,
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
        var resolver = new OnvifEndpointResolver(factory, TimeProvider.System, NullLogger<OnvifEndpointResolver>.Instance);
        var onvifClient = new OnvifClient(factory, resolver, TimeProvider.System, NullLogger<OnvifClient>.Instance);
        return (new OnvifPtzProvider(onvifClient, NullLogger<OnvifPtzProvider>.Instance), captured);
    }

    [Fact]
    public async Task PtzStopAsync_ShouldRaise_WhenTheCameraRefusesTheCommand()
    {
        // A camera in privacy mode refuses PTZ; swallowing that reads as a camera without PTZ (ADR-56).
        var (provider, _) = MakeProvider(handler: request =>
        {
            var body = request.Content?.ReadAsStringAsync().GetAwaiter().GetResult() ?? string.Empty;
            return body.Contains("Stop")
                ? new HttpResponseMessage(HttpStatusCode.InternalServerError)
                {
                    Content = new StringContent(
                        """<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"><s:Body><s:Fault><s:Reason><s:Text>Privacy mode is on</s:Text></s:Reason></s:Fault></s:Body></s:Envelope>""",
                        Encoding.UTF8, "application/soap+xml"),
                }
                : new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent("<s:Envelope/>", Encoding.UTF8, "application/soap+xml"),
                };
        });

        var error = await Assert.ThrowsAsync<CameraCommandRefusedException>(
            () => provider.PtzStopAsync(MakeCamera(), MakeBinding()));

        Assert.Contains("Privacy mode is on", error.Message);
    }

    // Answers every query, and hands the Stop command to the scenario under test.
    private static OnvifPtzProvider MakeProviderAnsweringStop(
        Func<CancellationToken, Task<HttpResponseMessage>> stop, TimeProvider time)
    {
        var factory = Substitute.For<IHttpClientFactory>();
        factory.CreateClient("onvif").Returns(new HttpClient(new ScenarioHandler(stop)));
        var resolver = new OnvifEndpointResolver(factory, time, NullLogger<OnvifEndpointResolver>.Instance);
        var onvifClient = new OnvifClient(factory, resolver, time, NullLogger<OnvifClient>.Instance);
        return new OnvifPtzProvider(onvifClient, NullLogger<OnvifPtzProvider>.Instance);
    }

    [Fact]
    public async Task PtzStopAsync_ShouldReportARefusal_WhenTheCameraAnswersWithAMalformedResponse()
    {
        var provider = MakeProviderAnsweringStop(
            _ => throw new HttpRequestException(HttpRequestError.InvalidResponse, "The response ended prematurely."),
            TimeProvider.System);

        var error = await Assert.ThrowsAsync<CameraCommandRefusedException>(
            () => provider.PtzStopAsync(MakeCamera(), MakeBinding()));

        Assert.Contains("malformed answer", error.Message);
    }

    [Fact]
    public async Task PtzStopAsync_ShouldReportTheCameraUnreachable_WhenItsAnswerIsCutOffHalfWay()
    {
        var provider = MakeProviderAnsweringStop(
            _ => throw new HttpRequestException(HttpRequestError.ResponseEnded, "The response ended prematurely."),
            TimeProvider.System);

        await Assert.ThrowsAsync<CameraUnreachableException>(
            () => provider.PtzStopAsync(MakeCamera(), MakeBinding()));
    }

    [Fact]
    public async Task PtzStopAsync_ShouldReportTheCameraUnreachable_WhenTheConnectionIsRefused()
    {
        var provider = MakeProviderAnsweringStop(
            _ => throw new HttpRequestException(HttpRequestError.ConnectionError, "Connection refused"),
            TimeProvider.System);

        await Assert.ThrowsAsync<CameraUnreachableException>(
            () => provider.PtzStopAsync(MakeCamera(), MakeBinding()));
    }

    [Fact]
    public async Task PtzStopAsync_ShouldCountTheCommandAsDone_WhenTheCameraIsSilentPastTheTimeout()
    {
        var time = new FakeTimeProvider();
        var stopArrived = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var provider = MakeProviderAnsweringStop(async ct =>
        {
            stopArrived.TrySetResult();
            await Task.Delay(Timeout.Infinite, ct);
            throw new InvalidOperationException("unreachable");
        }, time);

        var stop = provider.PtzStopAsync(MakeCamera(), MakeBinding());
        await stopArrived.Task;
        time.Advance(TimeSpan.FromSeconds(2));

        Assert.Null(await Record.ExceptionAsync(() => stop));
    }

    [Fact]
    public async Task ContinuousMoveAsync_ShouldReturnWithinAShortStep_WhenTheCameraIsSilent()
    {
        var time = new FakeTimeProvider();
        var moveArrived = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var factory = Substitute.For<IHttpClientFactory>();
        factory.CreateClient("onvif").Returns(new HttpClient(new SilentHandler(moveArrived)));
        var resolver = new OnvifEndpointResolver(factory, time, NullLogger<OnvifEndpointResolver>.Instance);
        var client = new OnvifClient(factory, resolver, time, NullLogger<OnvifClient>.Instance);

        var move = client.ContinuousMoveAsync(MakeCamera(), "profile_1", 1f, 0f, CancellationToken.None);
        await moveArrived.Task;
        time.Advance(TimeSpan.FromMilliseconds(350));

        Assert.Null(await Record.ExceptionAsync(() => move.WaitAsync(TimeSpan.FromSeconds(5))));
    }

    [Fact]
    public async Task PtzStopAsync_ShouldSendNoCredential_WhenTheCameraHasNoAccount()
    {
        var camera = MakeCamera();
        camera.Username = null;
        camera.Password = null;
        var (provider, requests) = MakeProvider();

        await provider.PtzStopAsync(camera, MakeBinding());

        var bodies = await ReadBodies(requests);
        Assert.Contains(bodies, body => body.Contains("GetProfiles", StringComparison.Ordinal));
        Assert.Contains(bodies, body => body.Contains("<Stop ", StringComparison.Ordinal));
        Assert.All(bodies, body => Assert.DoesNotContain("UsernameToken", body));
    }

    private sealed class SilentHandler(TaskCompletionSource arrived) : HttpMessageHandler
    {
        // Silent on the move only: the resolver's own questions get a plain refusal.
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            var body = request.Content is null ? string.Empty : await request.Content.ReadAsStringAsync(ct);
            if (!body.Contains("<ContinuousMove", StringComparison.Ordinal)) return new HttpResponseMessage(HttpStatusCode.NotFound);
            arrived.TrySetResult();
            await Task.Delay(Timeout.Infinite, ct);
            throw new InvalidOperationException("unreachable");
        }
    }

    private sealed class ScenarioHandler(Func<CancellationToken, Task<HttpResponseMessage>> stop) : HttpMessageHandler
    {
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            var body = request.Content is null ? string.Empty : await request.Content.ReadAsStringAsync(ct);
            if (body.Contains("<Stop")) return await stop(ct);
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("<s:Envelope/>", Encoding.UTF8, "application/soap+xml"),
            };
        }
    }

    [Fact]
    public void Protocol_ShouldBeOnvif_WhenTheProviderIsCreated()
    {
        var (provider, _) = MakeProvider();
        Assert.Equal(SupportedProtocol.Onvif, provider.Protocol);
    }

    [Fact]
    public async Task PtzMoveAsync_ShouldSendAContinuousMoveOnTheReturnedProfile_WhenTheCameraListsAProfile()
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
        Assert.Contains(bodies, body => body.Contains("GetProfiles"));
        var move = bodies.Last(body => body.Contains("ContinuousMove"));
        Assert.Contains("profile_1", move);
    }

    [Fact]
    public async Task PtzStopAsync_ShouldSendAStopCommandLast_WhenTheCameraAnswers()
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
    public async Task PtzMoveAsync_ShouldSendTheMatchingPanAndTiltVelocity_WhenMovingInEachDirection(PtzDirection direction, string expectedPan, string expectedTilt)
    {
        var (provider, requests) = MakeProvider();

        await provider.PtzMoveAsync(MakeCamera(), MakeBinding(), direction, speed: 80);

        var bodies = await ReadBodies(requests);
        var moveBody = bodies.First(b => b.Contains("ContinuousMove"));
        Assert.Contains($"x=\"{expectedPan}\"", moveBody);
        Assert.Contains($"y=\"{expectedTilt}\"", moveBody);
    }

    [Fact]
    public async Task ProbeAsync_ShouldReturnTrue_WhenTheCameraAnswersWithAProfile()
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
    public async Task ProbeAsync_ShouldAskForTheProfilesAndStillSucceed_WhenTheCameraReturnsNoProfile()
    {
        // OnvifPtzClient is resilient — uses default profile token on failure, so ProbeAsync
        // always returns true as long as no exception escapes GetFirstProfileTokenAsync.
        var (provider, requests) = MakeProvider();

        var result = await provider.ProbeAsync(MakeCamera(), MakeBinding());

        Assert.True(result);
        var bodies = await ReadBodies(requests);
        Assert.Contains(bodies, b => b.Contains("GetProfiles"));
    }

    private const string ProfileWithOnePresetXml = """
        <s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope">
          <s:Body>
            <trt:GetProfilesResponse xmlns:trt="http://www.onvif.org/ver10/media/wsdl">
              <trt:Profiles token="profile_1"/>
              <tptz:Preset xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl" token="1"/>
            </trt:GetProfilesResponse>
          </s:Body>
        </s:Envelope>
        """;

    [Fact]
    public async Task ProbeAsync_ShouldKeepThePanSwap_WhenItRecordsNativePresets()
    {
        var (provider, _) = MakeProvider(responseBody: ProfileWithOnePresetXml);
        var binding = MakeBinding();
        binding.ConfigJson = """{"pan_inverted":true}""";

        await provider.ProbeAsync(MakeCamera(), binding);

        Assert.True(BindingConfig.ReadBool(binding.ConfigJson, BindingConfig.SupportsNativePresets));
        Assert.True(BindingConfig.ReadBool(binding.ConfigJson, BindingConfig.PanInverted));
    }

    [Fact]
    public async Task ProbeAsync_ShouldWriteAFreshConfig_WhenTheStoredOneIsUnreadable()
    {
        var (provider, _) = MakeProvider(responseBody: ProfileWithOnePresetXml);
        var binding = MakeBinding();
        binding.ConfigJson = "not json";

        await provider.ProbeAsync(MakeCamera(), binding);

        Assert.True(BindingConfig.ReadBool(binding.ConfigJson, BindingConfig.SupportsNativePresets));
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
