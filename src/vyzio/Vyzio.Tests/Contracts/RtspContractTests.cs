using Microsoft.Extensions.Time.Testing;
using Vyzio.Core.Entities;
using Vyzio.Infrastructure.Services.CameraDiscovery;
using Vyzio.Infrastructure.VendorAdapters;
using Vyzio.Tests.Services;

namespace Vyzio.Tests.Contracts;

// The real RTSP login check of ADR-61 against what every captured camera answered (#92).
public sealed class RtspContractTests
{
    // What each captured variant yields, written once: a new firmware folder adds one row here.
    private static readonly Dictionary<string, RtspExpectation> Expected = new()
    {
        [CapturedVariant.TapoC200] = new(StreamPath: CapturedStreamPath.TapoC200, AsksForAnAccount: true),
        // Serves DESCRIBE without asking for any account.
        [CapturedVariant.V380Pro] = new(StreamPath: CapturedStreamPath.V380Pro, AsksForAnAccount: false),
    };

    public static TheoryData<string> Variants => FixtureLoader.VariantNames(FixtureProtocol.Rtsp);

    public static TheoryData<string> VariantsAskingForAnAccount => [.. Expected.Where(row => row.Value.AsksForAnAccount).Select(row => row.Key)];

    public static TheoryData<string> VariantsAskingForNoAccount => [.. Expected.Where(row => !row.Value.AsksForAnAccount).Select(row => row.Key)];

    [Fact]
    public void Variants_ShouldEachHaveAnExpectationRow_WhenTheirFixturesAreLoaded()
    {
        // Arrange
        var captured = FixtureLoader.Variants(FixtureProtocol.Rtsp).Select(variant => variant.Name);

        // Act
        var described = Expected.Keys.Order(StringComparer.Ordinal);

        // Assert
        Assert.Equal(captured, described);
    }

    [Theory]
    [MemberData(nameof(Variants))]
    public async Task DiscoverAsync_ShouldConfirmRtsp_WhenTheSweptPortAnswersTheCapturedOptions(string variant)
    {
        // Arrange
        await using var camera = Replay(variant, RtspScenario.DiscoveryOptions);

        // Act
        var port = await SweptDiscovery.DetectedPortAsync(camera, SupportedProtocol.Rtsp);

        // Assert
        Assert.Equal(SupportedProtocol.Rtsp.ToString(), port.Protocol);
        Assert.Equal(DiscoveryPortCatalog.FormatProtocolLabel(SupportedProtocol.Rtsp), port.Label);
        Assert.Equal(camera.Port, port.Port);
    }

    [Theory]
    [MemberData(nameof(Variants))]
    public async Task CheckAsync_ShouldAnswer_WhenTheCameraIsAskedWithTheFixtureAccount(string variant)
    {
        // Arrange
        await using var camera = Replay(variant, RtspScenario.DescribeLogin);

        // Act
        var answer = await RtspLogin.CheckAsync(OnStream(camera, variant, FixtureLoader.Neutral.Account.Password), new FakeTimeProvider(), CancellationToken.None);

        // Assert
        Assert.Equal(ProtocolStatus.Answers, answer.Status);
        Assert.Empty(camera.Unasked);
    }

    [Theory]
    [MemberData(nameof(VariantsAskingForAnAccount))]
    public async Task CheckAsync_ShouldBeRefused_WhenTheCameraIsAskedWithAWrongPassword(string variant)
    {
        // Arrange
        await using var camera = Replay(variant, RtspScenario.DescribeRefused);

        // Act
        var answer = await RtspLogin.CheckAsync(OnStream(camera, variant, FixtureLoader.Neutral.RefusedPassword), new FakeTimeProvider(), CancellationToken.None);

        // Assert
        Assert.Equal(ProtocolStatus.Refused, answer.Status);
    }

    [Theory]
    [MemberData(nameof(VariantsAskingForNoAccount))]
    public async Task CheckAsync_ShouldAnswer_WhenTheCameraAsksForNoAccountWhateverThePassword(string variant)
    {
        // Arrange
        await using var camera = Replay(variant, RtspScenario.DescribeLogin);

        // Act
        var answer = await RtspLogin.CheckAsync(OnStream(camera, variant, FixtureLoader.Neutral.RefusedPassword), new FakeTimeProvider(), CancellationToken.None);

        // Assert
        Assert.Equal(ProtocolStatus.Answers, answer.Status);
    }

    private static CapturedTcpCamera Replay(string variant, params string[] scenarios)
        => CapturedTcpCamera.Replaying(FixtureProtocol.Rtsp, variant, scenarios);

    // The login is asked on the recording stream, at the path the capture described (ADR-65 f).
    private static Camera OnStream(CapturedTcpCamera camera, string variant, string password)
        => camera.Camera(password).WithStream(SupportedProtocol.Rtsp, camera.Port, Expected[variant].StreamPath);

    private sealed record RtspExpectation(string StreamPath, bool AsksForAnAccount);
}
