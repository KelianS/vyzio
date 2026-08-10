using NSubstitute;
using Vyzio.Application.Commands;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Tests.UseCases;

public class PrivacyModeCommandHandlerTests
{
    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly ICameraCapabilityBindingRepository _bindings = Substitute.For<ICameraCapabilityBindingRepository>();
    private readonly IFrigateConfigApplier _frigate = Substitute.For<IFrigateConfigApplier>();

    private PrivacyModeCommandHandler CreateSut(params Camera[] cameras)
    {
        _bindings.GetAllVerifiedAsync(Arg.Any<CancellationToken>()).Returns([]);
        _cameras.GetAllAsync(Arg.Any<CancellationToken>()).Returns(cameras);
        foreach (var camera in cameras)
            _cameras.GetByIdAsync(camera.Id, Arg.Any<CancellationToken>()).Returns(camera);

        return new PrivacyModeCommandHandler(
            new GetCamerasUseCase(_cameras, _bindings),
            new ToggleCameraPrivacyModeUseCase(
                _cameras, _bindings, Substitute.For<ICapabilityProviderRegistry>(), _frigate));
    }

    private static Camera Camera(string slug, string displayName, bool privacy = false) => new()
    {
        Slug = slug,
        DisplayName = displayName,
        Host = "127.0.0.1",
        IsEnabled = true,
        PrivacyModeActive = privacy
    };

    private static CommandInvocation Ask(string? camera = null, bool confirmed = false) => new(
        RemoteCommandName.PrivacyMode,
        new CommandOrigin(NotificationChannel.Telegram, "conversation-1"),
        camera is null ? null : new Dictionary<string, string> { [PrivacyModeCommandHandler.CameraParameter] = camera },
        confirmed);

    [Fact]
    public void Declares_itself_as_needing_a_confirmation()
        => Assert.Equal(CommandAuthorization.PairedAndConfirmed, CreateSut().Descriptor.Authorization);

    [Fact]
    public async Task Asks_before_masking_and_touches_nothing_yet()
    {
        var result = await CreateSut(Camera("entree", "Entrée")).ExecuteAsync(Ask("entree"));

        Assert.Contains("Masquer Entrée", result.Message.Headline);
        Assert.True(Assert.Single(result.FollowUps!).Confirms);
        await _cameras.DidNotReceive().UpdateAsync(Arg.Any<Camera>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Masks_only_once_the_answer_was_confirmed()
    {
        var camera = Camera("entree", "Entrée");

        var result = await CreateSut(camera).ExecuteAsync(Ask("entree", confirmed: true));

        Assert.Contains("ne regarde plus rien", result.Message.Headline);
        Assert.True(camera.PrivacyModeActive);
        await _cameras.Received(1).UpdateAsync(camera, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Offers_each_camera_and_says_where_it_stands_when_none_was_named()
    {
        var result = await CreateSut(Camera("entree", "Entrée"), Camera("jardin", "Jardin", privacy: true))
            .ExecuteAsync(Ask());

        Assert.Equal(2, result.Message.Details.Count);
        Assert.Contains(result.Message.Details, detail => detail.Contains("masquee"));
        // Nothing here confirms anything: the first tap only picks a camera.
        Assert.All(result.FollowUps!, followUp => Assert.False(followUp.Confirms));
    }
}
