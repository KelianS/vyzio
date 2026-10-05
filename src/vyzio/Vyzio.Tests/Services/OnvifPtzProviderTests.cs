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
using Vyzio.Tests.Contracts;

namespace Vyzio.Tests.Services;

public class OnvifPtzProviderTests
{
    private static readonly TimeSpan ShortMove = TimeSpan.FromMilliseconds(100);

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
            Username = "admin",
            Password = "pass",
        };
        camera.SetProtocolEndpoint(SupportedProtocol.Onvif, "http://192.168.1.100:8899/onvif/device_service");
        return camera;
    }

    // A press that is never released, for tests of the move alone.
    private static readonly Task Held = new TaskCompletionSource().Task;

    // A press held then released: the stop it sends is the command under test.
    private static async Task ReleaseAHoldAsync(OnvifPtzProvider provider, Camera camera)
    {
        await using var motion = await provider.OpenMotionAsync(camera, MakeBinding());
        await motion.StartAsync(PtzDirection.Up, 50, Task.CompletedTask);
        await motion.StoppedAsync();
    }

    private static CameraCapabilityBinding MakeBinding() => new()
    {
        CameraId = "cam1",
        Capability = CameraCapability.Ptz,
        Protocol = SupportedProtocol.Onvif,
        Status = CapabilityStatus.Verified,
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
        return (new OnvifPtzProvider(onvifClient, new PtzMoveRunner(TimeProvider.System, NullLogger<PtzMoveRunner>.Instance), NullLogger<OnvifPtzProvider>.Instance), captured);
    }

    [Fact]
    public async Task StopAsync_ShouldRaise_WhenTheCameraRefusesTheCommand()
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
            () => ReleaseAHoldAsync(provider, MakeCamera()));

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
        return new OnvifPtzProvider(onvifClient, new PtzMoveRunner(time, NullLogger<PtzMoveRunner>.Instance), NullLogger<OnvifPtzProvider>.Instance);
    }

    [Fact]
    public async Task StopAsync_ShouldReportARefusal_WhenATapoC200InPrivacyModeAnswersWithAMalformedResponse()
    {
        var provider = MakeProviderAnsweringStop(
            _ => throw new HttpRequestException(HttpRequestError.InvalidResponse, "The response ended prematurely."),
            TimeProvider.System);

        var error = await Assert.ThrowsAsync<CameraCommandRefusedException>(
            () => ReleaseAHoldAsync(provider, MakeCamera()));

        Assert.Contains("malformed answer", error.Message);
    }

    [Fact]
    public async Task StopAsync_ShouldReportTheCameraUnreachable_WhenItsAnswerIsCutOffHalfWay()
    {
        var provider = MakeProviderAnsweringStop(
            _ => throw new HttpRequestException(HttpRequestError.ResponseEnded, "The response ended prematurely."),
            TimeProvider.System);

        await Assert.ThrowsAsync<CameraUnreachableException>(
            () => ReleaseAHoldAsync(provider, MakeCamera()));
    }

    [Fact]
    public async Task StopAsync_ShouldReportTheCameraUnreachable_WhenTheConnectionIsRefused()
    {
        var provider = MakeProviderAnsweringStop(
            _ => throw new HttpRequestException(HttpRequestError.ConnectionError, "Connection refused"),
            TimeProvider.System);

        await Assert.ThrowsAsync<CameraUnreachableException>(
            () => ReleaseAHoldAsync(provider, MakeCamera()));
    }

    [Fact]
    public async Task StoppedAsync_ShouldCountTheCommandAsDone_WhenAV380ProIsSilentPastTheTimeout()
    {
        // Arrange
        var time = new FakeTimeProvider();
        var stopArrived = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var provider = MakeProviderAnsweringStop(async ct =>
        {
            stopArrived.TrySetResult();
            await Task.Delay(Timeout.Infinite, ct);
            throw new InvalidOperationException("unreachable");
        }, time);
        await using var motion = await provider.OpenMotionAsync(MakeCamera(), MakeBinding());
        await motion.StartAsync(PtzDirection.Up, 50, Task.CompletedTask);
        time.Advance(PtzMoveRunner.MinimumHold);
        await stopArrived.Task;

        // Act
        time.Advance(TimeSpan.FromSeconds(2));

        // Assert
        Assert.Null(await Record.ExceptionAsync(motion.StoppedAsync));
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
    public async Task StopAsync_ShouldSendNoCredential_WhenTheCameraHasNoAccount()
    {
        var camera = MakeCamera();
        camera.Username = null;
        camera.Password = null;
        var (provider, requests) = MakeProvider();

        await ReleaseAHoldAsync(provider, camera);

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
    public async Task StartAsync_ShouldSendAContinuousMoveOnTheReturnedProfile_WhenTheCameraListsAProfile()
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

        await using var motion = await provider.OpenMotionAsync(MakeCamera(), MakeBinding());
        await motion.StartAsync(PtzDirection.Up, 80, Held);

        var bodies = await ReadBodies(requests);
        Assert.Contains(bodies, body => body.Contains("GetProfiles"));
        var move = bodies.Last(body => body.Contains("ContinuousMove"));
        Assert.Contains("profile_1", move);
    }

    [Fact]
    public async Task StoppedAsync_ShouldSendAStopCommandLast_WhenTheCameraAnswers()
    {
        var (provider, requests) = MakeProvider();

        await ReleaseAHoldAsync(provider, MakeCamera());

        var bodies = await ReadBodies(requests);
        Assert.Contains("Stop", bodies.Last());
    }

    [Theory]
    [InlineData(PtzDirection.Up, "0.00", "1.00")]
    [InlineData(PtzDirection.Down, "0.00", "-1.00")]
    [InlineData(PtzDirection.Left, "-1.00", "0.00")]
    [InlineData(PtzDirection.Right, "1.00", "0.00")]
    [InlineData(PtzDirection.UpLeft, "-1.00", "1.00")]
    [InlineData(PtzDirection.DownLeft, "-1.00", "-1.00")]
    [InlineData(PtzDirection.UpRight, "1.00", "1.00")]
    [InlineData(PtzDirection.DownRight, "1.00", "-1.00")]
    public async Task StartAsync_ShouldSendFullSpeedInTheDirectionPressed_WhenTheSpeedAskedIsLower(PtzDirection direction, string expectedPan, string expectedTilt)
    {
        var (provider, requests) = MakeProvider();

        await using var motion = await provider.OpenMotionAsync(MakeCamera(), MakeBinding());
        await motion.StartAsync(direction, 80, Held);

        var bodies = await ReadBodies(requests);
        var moveBody = bodies.First(b => b.Contains("ContinuousMove"));
        Assert.Contains($"x=\"{expectedPan}\"", moveBody);
        Assert.Contains($"y=\"{expectedTilt}\"", moveBody);
    }

    // A Tapo C200 as captured, found at the address MakeCamera already carries.
    private static FakeOnvifCamera TapoC200(params string[] scenarios)
        => FakeOnvifCamera.Replaying(CapturedVariant.TapoC200, [OnvifScenario.GetServices, .. scenarios]);

    private static OnvifPtzProvider MakeProviderFor(FakeOnvifCamera camera, TimeProvider? time = null)
    {
        var clock = time ?? TimeProvider.System;
        var factory = Substitute.For<IHttpClientFactory>();
        factory.CreateClient("onvif").Returns(_ => new HttpClient(camera, disposeHandler: false));
        var resolver = new OnvifEndpointResolver(factory, clock, NullLogger<OnvifEndpointResolver>.Instance);
        var onvifClient = new OnvifClient(factory, resolver, clock, NullLogger<OnvifClient>.Instance);
        return new OnvifPtzProvider(onvifClient, new PtzMoveRunner(clock, NullLogger<PtzMoveRunner>.Instance), NullLogger<OnvifPtzProvider>.Instance);
    }

    [Fact]
    public async Task MoveForAsync_ShouldStopTheDurationAfterTheContinuousMove_WhenTheCameraHasNotAnsweredTheMoveYet()
    {
        // Arrange
        var time = new FakeTimeProvider();
        var camera = new FakeOnvifCamera(FakeOnvifCamera.ProfileWithoutPtzXml, FakeOnvifCamera.PtzOptionsXml) { Clock = time, HoldsMoveAnswers = true };
        await using var motion = await MakeProviderFor(camera, time).OpenMotionAsync(MakeCamera(), MakeBinding());
        var step = motion.MoveForAsync(PtzDirection.Left, 10, ShortMove);
        var moved = await camera.NextArrivalAsync("ContinuousMove").WaitAsync(TimeSpan.FromSeconds(10));

        // Act
        time.Advance(ShortMove);
        var stopped = await camera.NextArrivalAsync("Stop").WaitAsync(TimeSpan.FromSeconds(10));

        // Assert
        Assert.Equal(ShortMove, stopped - moved);
        camera.AnswerMoves();
        Assert.Equal(ShortMove, await step);
    }

    [Fact]
    public async Task StoppedAsync_ShouldReturnTheTimeFromTheMoveSentToTheStopSent_WhenTheCameraAnswersTheMoveLate()
    {
        // Arrange
        var time = new FakeTimeProvider();
        var camera = new FakeOnvifCamera(FakeOnvifCamera.ProfileWithoutPtzXml, FakeOnvifCamera.PtzOptionsXml) { Clock = time, HoldsMoveAnswers = true };
        await using var motion = await MakeProviderFor(camera, time).OpenMotionAsync(MakeCamera(), MakeBinding());
        var released = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var start = motion.StartAsync(PtzDirection.Left, 10, released.Task);
        await camera.NextArrivalAsync("ContinuousMove").WaitAsync(TimeSpan.FromSeconds(10));
        time.Advance(TimeSpan.FromMilliseconds(200));
        camera.AnswerMoves();
        Assert.True(await start);
        time.Advance(TimeSpan.FromMilliseconds(1800));

        // Act
        released.SetResult();
        var moved = await motion.StoppedAsync();

        // Assert
        Assert.Equal(TimeSpan.FromSeconds(2), moved);
        Assert.Contains("<Stop", camera.Bodies.Last());
    }

    [Fact]
    public async Task StoppedAsync_ShouldCountEveryRelativeMoveOfTheHold_WhenThePtzOptionsOfferRelativeMove()
    {
        // Arrange
        var camera = TapoC200(OnvifScenario.GetProfiles, OnvifScenario.PtzGetConfigurationOptions);
        await using var motion = await MakeProviderFor(camera).OpenMotionAsync(MakeCamera(), MakeBinding());
        var released = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        Assert.True(await motion.StartAsync(PtzDirection.Left, 10, released.Task));

        // Act
        released.SetResult();
        var moved = await motion.StoppedAsync();

        // Assert
        Assert.Equal(camera.Bodies.Count(body => body.Contains("<RelativeMove", StringComparison.Ordinal)) * ShortMove, moved);
        Assert.DoesNotContain(camera.Bodies, body => body.Contains("<Stop", StringComparison.Ordinal));
    }

    [Fact]
    public async Task ProveAsync_ShouldFindPtzMissingWithoutGuessingAToken_WhenTheCameraAnswersOnvifWithoutAPtzConfiguration()
    {
        // Arrange
        var camera = new FakeOnvifCamera(FakeOnvifCamera.ProfileWithoutPtzXml, FakeOnvifCamera.PtzOptionsXml);
        var provider = MakeProviderFor(camera);

        // Act
        var result = await provider.ProveAsync(MakeCamera(), MakeBinding());

        // Assert
        Assert.Equal(ProofOutcome.Missing, result.Outcome);
        Assert.DoesNotContain(camera.Bodies, body => body.Contains("<GetConfigurationOptions", StringComparison.Ordinal));
    }

    [Fact]
    public async Task ProveAsync_ShouldFindPtzMissingWithoutAskingPtzOptions_WhenTheCameraListsNoProfile()
    {
        // Arrange
        var camera = new FakeOnvifCamera("<s:Envelope/>", FakeOnvifCamera.PtzOptionsXml);
        var provider = MakeProviderFor(camera);

        // Act
        var result = await provider.ProveAsync(MakeCamera(), MakeBinding());

        // Assert
        Assert.Equal(ProofOutcome.Missing, result.Outcome);
        Assert.DoesNotContain(camera.Bodies, body => body.Contains("<GetConfigurationOptions", StringComparison.Ordinal));
    }

    [Fact]
    public async Task MoveForAsync_ShouldMoveThenStopWithoutAskingPtzOptions_WhenTheProfileCarriesNoPtzConfiguration()
    {
        // Arrange
        var camera = new FakeOnvifCamera(FakeOnvifCamera.ProfileWithoutPtzXml, FakeOnvifCamera.PtzOptionsXml);
        var provider = MakeProviderFor(camera);

        // Act
        await using var motion = await provider.OpenMotionAsync(MakeCamera(), MakeBinding());
        await motion.MoveForAsync(PtzDirection.Left, 10, ShortMove);

        // Assert
        Assert.Contains(camera.Bodies, body => body.Contains("<ContinuousMove", StringComparison.Ordinal));
        Assert.Contains("<Stop", camera.Bodies.Last());
        Assert.DoesNotContain(camera.Bodies, body => body.Contains("<GetConfigurationOptions", StringComparison.Ordinal));
    }

    [Fact]
    public async Task MoveForAsync_ShouldSendARelativeMoveOnly_WhenThePtzOptionsOfferRelativeMove()
    {
        // Arrange
        var camera = TapoC200(OnvifScenario.GetProfiles, OnvifScenario.PtzGetConfigurationOptions);
        var provider = MakeProviderFor(camera);

        // Act
        await using var motion = await provider.OpenMotionAsync(MakeCamera(), MakeBinding());
        await motion.MoveForAsync(PtzDirection.Left, 10, ShortMove);

        // Assert
        Assert.Contains(camera.Bodies, body => body.Contains("<RelativeMove", StringComparison.Ordinal));
        Assert.DoesNotContain(camera.Bodies, body => body.Contains("<ContinuousMove", StringComparison.Ordinal));
        Assert.DoesNotContain(camera.Bodies, body => body.Contains("<Stop", StringComparison.Ordinal));
    }

    // Hand-written: no captured camera names a preset with a token that is not a number.
    [Fact]
    public async Task ReadPresetsAsync_ShouldIgnoreTheTokensThatNameNoNumber_WhenTheCameraListsThem()
    {
        // Arrange
        const string presets = """
            <s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope">
              <s:Body>
                <tptz:GetPresetsResponse xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl">
                  <tptz:Preset token="home"/>
                  <tptz:Preset token="2"/>
                </tptz:GetPresetsResponse>
              </s:Body>
            </s:Envelope>
            """;
        var provider = MakeProviderFor(new FakeOnvifCamera(FakeOnvifCamera.ProfileWithPtzXml, FakeOnvifCamera.PtzOptionsXml, presets));

        // Act
        var held = await provider.ReadPresetsAsync(MakeCamera(), MakeBinding());

        // Assert
        Assert.Equal([2], held);
    }

    [Fact]
    public async Task ReadPresetsAsync_ShouldRaiseRatherThanReadNone_WhenTheAnswerIsUnreadable()
    {
        // Arrange
        var provider = MakeProviderFor(new FakeOnvifCamera(FakeOnvifCamera.ProfileWithPtzXml, FakeOnvifCamera.PtzOptionsXml, "not xml"));

        // Act
        var error = await Record.ExceptionAsync(() => provider.ReadPresetsAsync(MakeCamera(), MakeBinding()));

        // Assert
        Assert.IsType<CameraCommandRefusedException>(error);
    }

    [Fact]
    public async Task MoveForAsync_ShouldMoveThenStop_WhenTheCameraRefusesThePtzConfigurationOptions()
    {
        // Arrange
        var camera = new FakeOnvifCamera(FakeOnvifCamera.ProfileWithPtzXml, configurationOptions: null);
        var provider = MakeProviderFor(camera);

        // Act
        await using var motion = await provider.OpenMotionAsync(MakeCamera(), MakeBinding());
        await motion.MoveForAsync(PtzDirection.Left, 10, ShortMove);

        // Assert
        Assert.Contains(camera.Bodies, body => body.Contains("<ContinuousMove", StringComparison.Ordinal));
        Assert.Contains("<Stop", camera.Bodies.Last());
    }

    [Fact]
    public async Task ProveAsync_ShouldFailTheCheck_WhenTheCameraRefusesThePtzConfigurationOptions()
    {
        // Arrange
        var camera = new FakeOnvifCamera(FakeOnvifCamera.ProfileWithPtzXml, configurationOptions: null);
        var provider = MakeProviderFor(camera);

        // Act & Assert
        await Assert.ThrowsAsync<CameraCommandRefusedException>(() => provider.ProveAsync(MakeCamera(), MakeBinding()));
    }

    [Fact]
    public async Task ProveAsync_ShouldFindPtzMissing_WhenTheOptionsAnswerDescribesNoPtz()
    {
        // Arrange
        var camera = new FakeOnvifCamera(FakeOnvifCamera.ProfileWithPtzXml, "<s:Envelope/>");
        var provider = MakeProviderFor(camera);

        // Act
        var result = await provider.ProveAsync(MakeCamera(), MakeBinding());

        // Assert
        Assert.Equal(ProofOutcome.Missing, result.Outcome);
    }

    [Fact]
    public async Task ProveAsync_ShouldNeverMoveTheCamera_WhenItVerifiesPtz()
    {
        // Arrange
        var camera = TapoC200(OnvifScenario.GetProfiles, OnvifScenario.PtzGetConfigurationOptions).Answering("GetNode", FakeOnvifCamera.NodeXml(8));
        var provider = MakeProviderFor(camera);

        // Act
        var result = await provider.ProveAsync(MakeCamera(), MakeBinding());

        // Assert
        Assert.Equal(ProofOutcome.Proven, result.Outcome);
        Assert.DoesNotContain(camera.Bodies, body => body.Contains("Move", StringComparison.Ordinal));
        Assert.DoesNotContain(camera.Bodies, body => body.Contains("<GotoPreset", StringComparison.Ordinal));
    }

    [Fact]
    public async Task ProveAsync_ShouldKeepThePanSwap_WhenItRecordsNativePresets()
    {
        // Arrange
        var provider = MakeProviderFor(TapoC200(OnvifScenario.GetProfiles, OnvifScenario.PtzGetConfigurationOptions).Answering("GetNode", FakeOnvifCamera.NodeXml(8)));
        var binding = MakeBinding();
        binding.ConfigJson = """{"pan_inverted":true}""";

        // Act
        await provider.ProveAsync(MakeCamera(), binding);

        // Assert
        Assert.True(BindingConfig.ReadBool(binding.ConfigJson, BindingConfig.SupportsNativePresets));
        Assert.True(BindingConfig.ReadBool(binding.ConfigJson, BindingConfig.PanInverted));
    }

    [Fact]
    public async Task ProveAsync_ShouldWriteAFreshConfig_WhenTheStoredOneIsUnreadable()
    {
        // Arrange
        var provider = MakeProviderFor(TapoC200(OnvifScenario.GetProfiles, OnvifScenario.PtzGetConfigurationOptions).Answering("GetNode", FakeOnvifCamera.NodeXml(8)));
        var binding = MakeBinding();
        binding.ConfigJson = "not json";

        // Act
        await provider.ProveAsync(MakeCamera(), binding);

        // Assert
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
