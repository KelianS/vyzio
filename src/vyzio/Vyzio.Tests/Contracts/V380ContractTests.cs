using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;
using Vyzio.Core.Entities;
using Vyzio.Infrastructure.Services.CameraDiscovery;
using Vyzio.Infrastructure.VendorAdapters;
using Vyzio.Tests.Services;

namespace Vyzio.Tests.Contracts;

// The real V380 port-8800 client against what every captured camera answered (#92).
public sealed class V380ContractTests
{
    // What each captured variant yields, written once: a new firmware folder adds one row here.
    private static readonly Dictionary<string, V380Expectation> Expected = new()
    {
        [CapturedVariant.V380Pro] = new(WrongPassword: ProtocolStatus.Refused),
    };

    public static TheoryData<string> Variants => FixtureLoader.VariantNames(FixtureProtocol.V380);

    [Fact]
    public void Variants_ShouldEachHaveAnExpectationRow_WhenTheirFixturesAreLoaded()
    {
        // Arrange
        var captured = FixtureLoader.Variants(FixtureProtocol.V380).Select(variant => variant.Name);

        // Act
        var described = Expected.Keys.Order(StringComparer.Ordinal);

        // Assert
        Assert.Equal(captured, described);
    }

    [Theory]
    [MemberData(nameof(Variants))]
    public async Task DiscoverAsync_ShouldConfirmV380_WhenTheSweptPortAnswersTheCapturedFingerprint(string variant)
    {
        // Arrange
        await using var camera = Replay(variant, V380Scenario.DiscoveryFingerprint);

        // Act
        var port = await SweptDiscovery.DetectedPortAsync(camera, SupportedProtocol.V380);

        // Assert
        Assert.Equal(SupportedProtocol.V380.ToString(), port.Protocol);
        Assert.Equal(DiscoveryPortCatalog.FormatProtocolLabel(SupportedProtocol.V380), port.Label);
        Assert.Equal(camera.Port, port.Port);
    }

    // The V380 answer is the one signal strong enough to name the vendor (ADR-71).
    [Theory]
    [MemberData(nameof(Variants))]
    public async Task DiscoverAsync_ShouldNameTheV380Vendor_WhenTheSweptPortAnswersTheCapturedFingerprint(string variant)
    {
        // Arrange
        await using var camera = Replay(variant, V380Scenario.DiscoveryFingerprint);

        // Act
        var candidate = await SweptDiscovery.CandidateAsync(camera, SupportedProtocol.V380);

        // Assert
        Assert.Equal(VendorFamily.V380Pro, candidate.VendorFamily);
    }

    [Theory]
    [MemberData(nameof(Variants))]
    public async Task CheckLoginAsync_ShouldAnswer_WhenTheCameraIsAskedWithTheFixtureAccount(string variant)
    {
        // Arrange
        await using var camera = Replay(variant, V380Scenario.Auth);
        var (client, target) = ClientFor(camera.Camera(FixtureLoader.Neutral.Account.Password));

        // Act
        var answer = await client.CheckLoginAsync(target, new FakeTimeProvider(), CancellationToken.None);

        // Assert
        Assert.Equal(ProtocolStatus.Answers, answer.Status);
    }

    [Theory]
    [MemberData(nameof(Variants))]
    public async Task CheckLoginAsync_ShouldGiveTheCapturedVerdict_WhenTheCameraIsAskedWithAWrongPassword(string variant)
    {
        // Arrange
        await using var camera = Replay(variant, V380Scenario.AuthRefused);
        var (client, target) = ClientFor(camera.Camera(FixtureLoader.Neutral.RefusedPassword));

        // Act
        var answer = await client.CheckLoginAsync(target, new FakeTimeProvider(), CancellationToken.None);

        // Assert
        Assert.Equal(Expected[variant].WrongPassword, answer.Status);
    }

    private static CapturedTcpCamera Replay(string variant, params string[] scenarios)
        => CapturedTcpCamera.Replaying(FixtureProtocol.V380, variant, scenarios);

    // The device number the capture addressed, typed on the protocol line as the user would (ADR-61).
    private static (V380Client Client, Camera Camera) ClientFor(Camera camera)
    {
        camera.Protocol(SupportedProtocol.V380)!.DeviceId = FixtureLoader.Neutral.V380DeviceId;
        var client = new V380Client(NullLogger<V380Client>.Instance);
        V380DeviceIdBootstrap.PreloadStored(camera, client);
        return (client, camera);
    }

    private sealed record V380Expectation(ProtocolStatus WrongPassword);
}
