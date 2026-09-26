using NSubstitute;
using Vyzio.Application.Commands;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Tests.UseCases;

public class SnapshotCommandHandlerTests
{
    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly ICameraCapabilityBindingRepository _bindings = Substitute.For<ICameraCapabilityBindingRepository>();
    private readonly IFrigateLiveFrameProvider _frames = Substitute.For<IFrigateLiveFrameProvider>();

    private static readonly byte[] Frame = [0xFF, 0xD8, 0xFF];

    private SnapshotCommandHandler CreateSut(params Camera[] cameras)
    {
        _bindings.GetAllVerifiedAsync(Arg.Any<CancellationToken>()).Returns([]);
        _cameras.GetAllAsync(Arg.Any<CancellationToken>()).Returns(cameras);
        return new SnapshotCommandHandler(new GetCamerasUseCase(_cameras, _bindings), _frames);
    }

    private static Camera Camera(string slug, string displayName, bool privacy = false) => new()
    {
        Slug = slug,
        FrigateCameraName = slug.Replace('-', '_'),
        DisplayName = displayName,
        Host = "127.0.0.1",
        IsEnabled = true,
        PrivacyModeActive = privacy
    };

    private static CommandInvocation Ask(string? camera = null) => new(
        RemoteCommandName.Snapshot,
        new CommandOrigin(NotificationChannel.Telegram, "conversation-1"),
        camera is null ? null : new Dictionary<string, string> { [SnapshotCommandHandler.CameraParameter] = camera });

    [Fact]
    public void Descriptor_ShouldUseTheUserVerbWithOneCameraParameter_WhenTheSnapshotCommandIsDescribed()
    {
        var descriptor = CreateSut().Descriptor;

        Assert.Equal("apercu", descriptor.Verb);
        Assert.Equal(CommandParameterKind.Camera, Assert.Single(descriptor.Parameters).Kind);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldSendTheFrameOfTheNamedCamera_WhenItIsNamedWithoutAccents()
    {
        _frames.TryGetLatestFrameAsync("entree", Arg.Any<CancellationToken>()).Returns(Frame);

        var result = await CreateSut(Camera("entree", "Entrée")).ExecuteAsync(Ask("entree"));

        Assert.NotNull(result.Photo);
        Assert.Contains("Entrée", result.Message.Headline);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldTakeTheOnlyCamera_WhenThereIsNothingToChooseFrom()
    {
        _frames.TryGetLatestFrameAsync("jardin", Arg.Any<CancellationToken>()).Returns(Frame);

        var result = await CreateSut(Camera("jardin", "Jardin")).ExecuteAsync(Ask());

        Assert.NotNull(result.Photo);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldAskWhichCameraRatherThanGuess_WhenSeveralCouldAnswer()
    {
        var result = await CreateSut(Camera("entree", "Entrée"), Camera("jardin", "Jardin"))
            .ExecuteAsync(Ask());

        Assert.Null(result.Photo);
        Assert.Equal(2, result.FollowUps!.Count);
        Assert.Contains(result.FollowUps, followUp => followUp.Label == "Jardin");
    }

    [Fact]
    public async Task ExecuteAsync_ShouldOfferTheKnownCameras_WhenTheNamedCameraIsUnknown()
    {
        var result = await CreateSut(Camera("entree", "Entrée")).ExecuteAsync(Ask("garage"));

        Assert.Null(result.Photo);
        Assert.Contains("garage", result.Message.Headline);
        Assert.Contains(result.FollowUps!, followUp => followUp.Label == "Entrée");
    }

    [Fact]
    public async Task ExecuteAsync_ShouldSayPrivacyModeIsOnWithoutFetchingAFrame_WhenTheCameraIsInPrivacyMode()
    {
        var result = await CreateSut(Camera("entree", "Entrée", privacy: true)).ExecuteAsync(Ask("entree"));

        Assert.Null(result.Photo);
        Assert.Contains("vie privee", result.Message.Headline);
        await _frames.DidNotReceive().TryGetLatestFrameAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldSayItCannotSeeRatherThanStaySilent_WhenNoFrameIsAvailable()
    {
        _frames.TryGetLatestFrameAsync("entree", Arg.Any<CancellationToken>()).Returns((byte[]?)null);

        var result = await CreateSut(Camera("entree", "Entrée")).ExecuteAsync(Ask("entree"));

        Assert.Null(result.Photo);
        Assert.False(result.Silent);
    }
}
