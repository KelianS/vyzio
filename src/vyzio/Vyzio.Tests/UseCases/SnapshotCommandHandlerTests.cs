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
    public void Is_named_after_what_one_asks_for_not_after_the_code()
    {
        var descriptor = CreateSut().Descriptor;

        Assert.Equal("apercu", descriptor.Verb);
        Assert.Equal(CommandParameterKind.Camera, Assert.Single(descriptor.Parameters).Kind);
    }

    [Fact]
    public async Task Sends_the_frame_of_the_camera_that_was_named_accents_aside()
    {
        _frames.TryGetLatestFrameAsync("entree", Arg.Any<CancellationToken>()).Returns(Frame);

        var result = await CreateSut(Camera("entree", "Entrée")).ExecuteAsync(Ask("entree"));

        Assert.NotNull(result.Photo);
        Assert.Contains("Entrée", result.Message.Headline);
    }

    [Fact]
    public async Task Takes_the_only_camera_when_there_is_nothing_to_choose_from()
    {
        _frames.TryGetLatestFrameAsync("jardin", Arg.Any<CancellationToken>()).Returns(Frame);

        var result = await CreateSut(Camera("jardin", "Jardin")).ExecuteAsync(Ask());

        Assert.NotNull(result.Photo);
    }

    [Fact]
    public async Task Asks_which_one_rather_than_guessing_when_several_could_answer()
    {
        var result = await CreateSut(Camera("entree", "Entrée"), Camera("jardin", "Jardin"))
            .ExecuteAsync(Ask());

        Assert.Null(result.Photo);
        Assert.Equal(2, result.FollowUps!.Count);
        Assert.Contains(result.FollowUps, followUp => followUp.Label == "Jardin");
    }

    [Fact]
    public async Task Names_the_cameras_it_knows_when_the_one_asked_for_is_not_among_them()
    {
        var result = await CreateSut(Camera("entree", "Entrée")).ExecuteAsync(Ask("garage"));

        Assert.Null(result.Photo);
        Assert.Contains("garage", result.Message.Headline);
        Assert.Contains(result.FollowUps!, followUp => followUp.Label == "Entrée");
    }

    [Fact]
    public async Task Says_the_camera_is_in_privacy_mode_rather_than_sending_a_black_frame()
    {
        var result = await CreateSut(Camera("entree", "Entrée", privacy: true)).ExecuteAsync(Ask("entree"));

        Assert.Null(result.Photo);
        Assert.Contains("vie privee", result.Message.Headline);
        await _frames.DidNotReceive().TryGetLatestFrameAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Says_it_cannot_see_rather_than_sending_nothing()
    {
        _frames.TryGetLatestFrameAsync("entree", Arg.Any<CancellationToken>()).Returns((byte[]?)null);

        var result = await CreateSut(Camera("entree", "Entrée")).ExecuteAsync(Ask("entree"));

        Assert.Null(result.Photo);
        Assert.False(result.Silent);
    }
}
