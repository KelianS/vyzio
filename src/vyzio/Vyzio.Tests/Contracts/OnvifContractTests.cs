using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Vyzio.Core.Common;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.CapabilityProviders;
using Vyzio.Infrastructure.VendorAdapters;
using Vyzio.Tests.Services;

namespace Vyzio.Tests.Contracts;

// The real ONVIF client and providers against what every captured camera answered (#92).
public sealed class OnvifContractTests
{
    // What each captured variant yields, written once: a new firmware folder adds one row here.
    private static readonly Dictionary<string, OnvifExpectation> Expected = new()
    {
        [CapturedVariant.TapoC200] = new(
            Manufacturer: "tp-link",
            Model: "Tapo C200",
            FirstProfile: new OnvifMediaProfile("profile_1", "raw_vs1", 1280, 720, 15),
            StreamUri: "rtsp://192.0.2.10:554/stream1",
            PtzConfigurationToken: "PTZTOKEN",
            RelativeMove: true,
            Position: (0.177353f, -0.713568f),
            PresetCount: 4,
            NativePresets: true,
            ImageSettings: new CameraImageSettings(50, 50, 50, 50, IrCutMode.Auto),
            WrongPassword: ProtocolStatus.Refused),
        // Answers GetDeviceInformation whatever the password, and implements neither PTZ status, presets nor imaging.
        [CapturedVariant.V380Pro] = new(
            Manufacturer: "IPCAM",
            Model: "IPCAM",
            FirstProfile: new OnvifMediaProfile("stream0_0", "VideoSource0", 1920, 1080, 20),
            StreamUri: "rtsp://192.0.2.10/live/ch00_1",
            PtzConfigurationToken: "Anv_ptz_0",
            RelativeMove: false,
            Position: null,
            PresetCount: 0,
            NativePresets: false,
            ImageSettings: null,
            WrongPassword: ProtocolStatus.Answers),
    };

    public static TheoryData<string> Variants => FixtureLoader.VariantNames(FixtureProtocol.Onvif);

    public static TheoryData<string> VariantsWithImaging => [.. Expected.Where(row => row.Value.ImageSettings is not null).Select(row => row.Key)];

    public static TheoryData<string> VariantsWithoutImaging => [.. Expected.Where(row => row.Value.ImageSettings is null).Select(row => row.Key)];

    [Fact]
    public void Expected_ShouldCoverEveryCapturedVariant_WhenAFirmwareFolderIsAdded()
    {
        // Arrange
        var captured = FixtureLoader.Variants(FixtureProtocol.Onvif).Select(variant => variant.Name);

        // Act
        var described = Expected.Keys.Order(StringComparer.Ordinal);

        // Assert
        Assert.Equal(captured, described);
    }

    [Theory]
    [MemberData(nameof(Variants))]
    public async Task CheckLoginAsync_ShouldAnswer_WhenTheCameraIsAskedWithTheFixtureAccount(string variant)
    {
        // Arrange
        var client = ClientOver(Replay(variant, OnvifScenario.GetDeviceInformation));

        // Act
        var answer = await client.CheckLoginAsync(CameraWith(FixtureLoader.Neutral.Account.Password), CancellationToken.None);

        // Assert
        Assert.Equal(ProtocolStatus.Answers, answer.Status);
    }

    [Theory]
    [MemberData(nameof(Variants))]
    public async Task CheckLoginAsync_ShouldGiveTheCapturedVerdict_WhenTheCameraIsAskedWithAWrongPassword(string variant)
    {
        // Arrange
        var client = ClientOver(Replay(variant, OnvifScenario.GetDeviceInformationRefused));

        // Act
        var answer = await client.CheckLoginAsync(CameraWith(FixtureLoader.Neutral.RefusedPassword), CancellationToken.None);

        // Assert
        Assert.Equal(Expected[variant].WrongPassword, answer.Status);
    }

    [Theory]
    [MemberData(nameof(Variants))]
    public async Task GetDeviceInformationAsync_ShouldReadTheCapturedIdentity_WhenTheCameraDescribesItself(string variant)
    {
        // Arrange
        var client = ClientOver(Replay(variant, OnvifScenario.GetDeviceInformation));

        // Act
        var info = await client.GetDeviceInformationAsync(FixtureCamera(), CancellationToken.None);

        // Assert
        Assert.NotNull(info);
        Assert.Equal(Expected[variant].Manufacturer, info.Manufacturer);
        Assert.Equal(Expected[variant].Model, info.Model);
        Assert.Equal(FixtureLoader.Variant(FixtureProtocol.Onvif, variant).Firmware, info.FirmwareVersion);
    }

    [Theory]
    [MemberData(nameof(Variants))]
    public async Task GetMediaProfilesAsync_ShouldReadTheFirstProfile_WhenTheCameraListsItsProfiles(string variant)
    {
        // Arrange
        var client = ClientOver(Replay(variant, OnvifScenario.GetProfiles));

        // Act
        var profiles = await client.GetMediaProfilesAsync(FixtureCamera(), CancellationToken.None);

        // Assert
        Assert.Equal(Expected[variant].FirstProfile, profiles[0]);
    }

    [Theory]
    [MemberData(nameof(Variants))]
    public async Task GetStreamUriAsync_ShouldReturnTheCapturedAddress_WhenAskedForTheFirstProfile(string variant)
    {
        // Arrange
        var client = ClientOver(Replay(variant, OnvifScenario.GetStreamUri));

        // Act
        var uri = await client.GetStreamUriAsync(FixtureCamera(), Expected[variant].FirstProfile.Token, CancellationToken.None);

        // Assert
        Assert.Equal(Expected[variant].StreamUri, uri);
    }

    [Theory]
    [MemberData(nameof(Variants))]
    public async Task ProveAsync_ShouldProvePtzAndRecordItsNativePresets_WhenTheCameraDescribesItsPtz(string variant)
    {
        // Arrange
        var peer = Replay(variant, OnvifScenario.GetProfiles, OnvifScenario.PtzGetConfigurationOptions, OnvifScenario.PtzGetPresets);
        var binding = PtzBinding();

        // Act
        var proof = await PtzProviderOver(peer).ProveAsync(FixtureCamera(), binding);

        // Assert
        Assert.Equal(ProofOutcome.Proven, proof.Outcome);
        Assert.Contains(peer.Bodies, body => body.Contains($"<ConfigurationToken>{Expected[variant].PtzConfigurationToken}</ConfigurationToken>", StringComparison.Ordinal));
        Assert.Equal(Expected[variant].NativePresets, BindingConfig.ReadBool(binding.ConfigJson, BindingConfig.SupportsNativePresets));
    }

    [Theory]
    [MemberData(nameof(Variants))]
    public async Task MoveForAsync_ShouldSendARelativeMoveOnlyWhereOffered_WhenTheCameraDescribesItsPtzSpaces(string variant)
    {
        // Arrange
        var peer = Replay(variant, OnvifScenario.GetProfiles, OnvifScenario.PtzGetConfigurationOptions);
        await using var motion = await PtzProviderOver(peer).OpenMotionAsync(FixtureCamera(), PtzBinding());

        // Act
        await motion.MoveForAsync(PtzDirection.Left, 10, TimeSpan.FromMilliseconds(100));

        // Assert
        Assert.Equal(Expected[variant].RelativeMove, peer.Bodies.Exists(body => body.Contains("<RelativeMove", StringComparison.Ordinal)));
    }

    [Theory]
    [MemberData(nameof(Variants))]
    public async Task GetPtzPositionAsync_ShouldReadTheCapturedPosition_WhenTheCameraReportsItsStatus(string variant)
    {
        // Arrange
        var provider = PtzProviderOver(Replay(variant, OnvifScenario.GetProfiles, OnvifScenario.PtzGetStatus));

        // Act
        var position = await provider.GetPtzPositionAsync(FixtureCamera(), PtzBinding());

        // Assert
        Assert.Equal(Expected[variant].Position, position);
    }

    [Theory]
    [MemberData(nameof(Variants))]
    public async Task GetPresetsCountAsync_ShouldCountTheCapturedPresets_WhenTheCameraListsThem(string variant)
    {
        // Arrange
        var client = ClientOver(Replay(variant, OnvifScenario.PtzGetPresets));

        // Act
        var count = await client.GetPresetsCountAsync(FixtureCamera(), Expected[variant].FirstProfile.Token, CancellationToken.None);

        // Assert
        Assert.Equal(Expected[variant].PresetCount, count);
    }

    [Theory]
    [MemberData(nameof(VariantsWithImaging))]
    public async Task GetImageSettingsAsync_ShouldReadTheCapturedSettings_WhenTheCameraAnnouncesImaging(string variant)
    {
        // Arrange
        var provider = new OnvifImageSettingsProvider(ClientOver(Replay(variant, OnvifScenario.GetProfiles, OnvifScenario.ImagingGetImagingSettings)));

        // Act
        var settings = await provider.GetImageSettingsAsync(FixtureCamera(), ImagingBinding());

        // Assert
        Assert.Equal(Expected[variant].ImageSettings, settings);
    }

    [Theory]
    [MemberData(nameof(VariantsWithoutImaging))]
    public async Task GetImageSettingsAsync_ShouldRaiseTheCameraRefusal_WhenTheCameraDoesNotImplementImaging(string variant)
    {
        // Arrange
        var provider = new OnvifImageSettingsProvider(ClientOver(Replay(variant, OnvifScenario.GetProfiles, OnvifScenario.ImagingGetImagingSettings)));

        // Act
        var error = await Assert.ThrowsAsync<CameraCommandRefusedException>(() => provider.GetImageSettingsAsync(FixtureCamera(), ImagingBinding()));

        // Assert
        Assert.Contains("not implemented", error.Message, StringComparison.Ordinal);
    }

    // Every exchange starts where the client does: finding the device service, then where the others live.
    private static FakeOnvifCamera Replay(string variant, params string[] scenarios)
        => FakeOnvifCamera.Replaying(variant, [OnvifScenario.Discovery, OnvifScenario.GetServices, .. scenarios]);

    private static Camera FixtureCamera() => CameraWith(FixtureLoader.Neutral.Account.Password);

    private static Camera CameraWith(string password) => new()
    {
        Id = "cam1",
        Slug = "cam1",
        FrigateCameraName = "cam1",
        DisplayName = "cam1",
        Host = FixtureLoader.Neutral.CameraHost,
        Username = FixtureLoader.Neutral.Account.Username,
        Password = password,
    };

    private static OnvifClient ClientOver(FakeOnvifCamera peer)
    {
        var factory = Substitute.For<IHttpClientFactory>();
        factory.CreateClient("onvif").Returns(_ => new HttpClient(peer, disposeHandler: false));
        var resolver = new OnvifEndpointResolver(factory, TimeProvider.System, NullLogger<OnvifEndpointResolver>.Instance);
        return new OnvifClient(factory, resolver, TimeProvider.System, NullLogger<OnvifClient>.Instance);
    }

    private static OnvifPtzProvider PtzProviderOver(FakeOnvifCamera peer)
        => new(ClientOver(peer), new PtzMoveRunner(TimeProvider.System, NullLogger<PtzMoveRunner>.Instance), NullLogger<OnvifPtzProvider>.Instance);

    private static CameraCapabilityBinding PtzBinding() => new()
    {
        CameraId = "cam1",
        Capability = CameraCapability.Ptz,
        Protocol = SupportedProtocol.Onvif,
        Status = CapabilityStatus.Verified,
    };

    private static CameraCapabilityBinding ImagingBinding() => new()
    {
        CameraId = "cam1",
        Capability = CameraCapability.ImageSettings,
        Protocol = SupportedProtocol.Onvif,
        Status = CapabilityStatus.Verified,
    };

    private sealed record OnvifExpectation(
        string Manufacturer,
        string Model,
        OnvifMediaProfile FirstProfile,
        string StreamUri,
        string PtzConfigurationToken,
        bool RelativeMove,
        (float Pan, float Tilt)? Position,
        int PresetCount,
        bool NativePresets,
        CameraImageSettings? ImageSettings,
        ProtocolStatus WrongPassword);
}
