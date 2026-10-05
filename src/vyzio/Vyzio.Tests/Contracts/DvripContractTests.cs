using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;
using Vyzio.Core.Common;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.CapabilityProviders;
using Vyzio.Infrastructure.Services.CameraDiscovery;
using Vyzio.Infrastructure.VendorAdapters;
using Vyzio.Tests.Services;

namespace Vyzio.Tests.Contracts;

// The real DVRIP client and PTZ provider against what every captured camera answered (#92).
public sealed class DvripContractTests
{
    private const int SystemInfoCmd = 1020;

    // What each captured variant yields, written once: a new firmware folder adds one row here.
    private static readonly Dictionary<string, DvripExpectation> Expected = new()
    {
        [CapturedVariant.Icsee] = new(
            RefusedLoginRet: 203,
            DeviceModel: "IPC_GK7201V300_LPG-G3-WQ",
            Proof: ProofOutcome.Proven,
            NativePresets: true),
    };

    public static TheoryData<string> Variants => FixtureLoader.VariantNames(FixtureProtocol.Dvrip);

    [Fact]
    public void Variants_ShouldEachHaveAnExpectationRow_WhenTheirFixturesAreLoaded()
    {
        // Arrange
        var captured = FixtureLoader.Variants(FixtureProtocol.Dvrip).Select(variant => variant.Name);

        // Act
        var described = Expected.Keys.Order(StringComparer.Ordinal);

        // Assert
        Assert.Equal(captured, described);
    }

    [Theory]
    [MemberData(nameof(Variants))]
    public async Task DiscoverAsync_ShouldConfirmDvrip_WhenTheSweptPortAnswersTheCapturedBanner(string variant)
    {
        // Arrange
        await using var camera = Replay(variant, DvripScenario.DiscoveryBanner);

        // Act
        var port = await SweptDiscovery.DetectedPortAsync(camera, SupportedProtocol.Dvrip);

        // Assert
        Assert.Equal(SupportedProtocol.Dvrip.ToString(), port.Protocol);
        Assert.Equal(DiscoveryPortCatalog.FormatProtocolLabel(SupportedProtocol.Dvrip), port.Label);
        Assert.Equal(camera.Port, port.Port);
    }

    [Theory]
    [MemberData(nameof(Variants))]
    public async Task CheckLoginAsync_ShouldAnswer_WhenTheCameraIsAskedWithTheFixtureAccount(string variant)
    {
        // Arrange
        await using var camera = Replay(variant, DvripScenario.Login);

        // Act
        var answer = await Client().CheckLoginAsync(camera.Camera(FixtureLoader.Neutral.Account.Password), CancellationToken.None);

        // Assert
        Assert.Equal(ProtocolStatus.Answers, answer.Status);
    }

    [Theory]
    [MemberData(nameof(Variants))]
    public async Task CheckLoginAsync_ShouldBeRefused_WhenTheCameraIsAskedWithAWrongPassword(string variant)
    {
        // Arrange
        await using var camera = Replay(variant, DvripScenario.LoginRefused);

        // Act
        var answer = await Client().CheckLoginAsync(camera.Camera(FixtureLoader.Neutral.RefusedPassword), CancellationToken.None);

        // Assert
        Assert.Equal(ProtocolStatus.Refused, answer.Status);
    }

    [Theory]
    [MemberData(nameof(Variants))]
    public async Task OpenSessionAsync_ShouldRaiseTheCapturedReturnCode_WhenTheCameraTurnsTheLoginDown(string variant)
    {
        // Arrange
        await using var camera = Replay(variant, DvripScenario.LoginRefused);

        // Act
        var error = await Assert.ThrowsAsync<CameraCommandRefusedException>(
            () => Client().OpenSessionAsync(camera.Camera(FixtureLoader.Neutral.RefusedPassword), CancellationToken.None));

        // Assert
        Assert.Contains($"Ret={Expected[variant].RefusedLoginRet}", error.Message, StringComparison.Ordinal);
    }

    // No product code reads SystemInfo: the session framing is what this holds to the capture.
    [Theory]
    [MemberData(nameof(Variants))]
    public async Task ExecuteAsync_ShouldReadTheCapturedModelAndFirmware_WhenTheSessionAsksForSystemInfo(string variant)
    {
        // Arrange
        await using var camera = Replay(variant, DvripScenario.SystemInfo);
        await using var session = await Client().OpenSessionAsync(camera.Camera(FixtureLoader.Neutral.Account.Password), CancellationToken.None);

        // Act
        var answer = await session.ExecuteAsync(SystemInfoCmd, sessionId => JsonSerializer.Serialize(new { Name = "SystemInfo", SessionID = sessionId }), CancellationToken.None);

        // Assert
        var info = JsonNode.Parse(answer!)!["SystemInfo"]!;
        Assert.Equal(Expected[variant].DeviceModel, info["DeviceModel"]!.GetValue<string>());
        Assert.Equal(FixtureLoader.Variant(FixtureProtocol.Dvrip, variant).Firmware, info["SoftWareVersion"]!.GetValue<string>());
    }

    // The list comes first: the provider reads which slots are taken before storing on a spare one (ADR-64).
    [Theory]
    [MemberData(nameof(Variants))]
    public async Task ProveAsync_ShouldStoreThenClearTheProbeSlotAndRecordTheVerdict_WhenTheCameraListsItsPresets(string variant)
    {
        // Arrange
        await using var camera = Replay(variant, DvripScenario.PtzPresetList, DvripScenario.PtzPresetStoreAndClear);
        var binding = new CameraCapabilityBinding { CameraId = "cam1", Capability = CameraCapability.Ptz, Protocol = SupportedProtocol.Dvrip };

        // Act
        var proof = await PtzProvider().ProveAsync(camera.Camera(FixtureLoader.Neutral.Account.Password), binding);

        // Assert
        Assert.Equal(Expected[variant].Proof, proof.Outcome);
        Assert.Equal(Expected[variant].NativePresets, BindingConfig.ReadBool(binding.ConfigJson, BindingConfig.SupportsNativePresets));
        Assert.Empty(camera.Unasked);
    }

    private static CapturedTcpCamera Replay(string variant, params string[] scenarios)
        => CapturedTcpCamera.Replaying(FixtureProtocol.Dvrip, variant, scenarios);

    // The clock stays still: the verdict comes from what the peer answered, not from how fast.
    private static DvripClient Client() => new(new FakeTimeProvider());

    private static DvripPtzProvider PtzProvider()
        => new(Client(), new PtzMoveRunner(new FakeTimeProvider(), NullLogger<PtzMoveRunner>.Instance), NullLogger<DvripPtzProvider>.Instance);

    private sealed record DvripExpectation(
        int RefusedLoginRet,
        string DeviceModel,
        ProofOutcome Proof,
        bool NativePresets);
}
