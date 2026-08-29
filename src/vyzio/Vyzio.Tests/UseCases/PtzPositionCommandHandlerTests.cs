using NSubstitute;
using Vyzio.Application.Commands;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Tests.UseCases;

public class PtzPositionCommandHandlerTests
{
    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly ICameraCapabilityBindingRepository _bindings = Substitute.For<ICameraCapabilityBindingRepository>();
    private readonly IPtzPresetRepository _presets = Substitute.For<IPtzPresetRepository>();
    private readonly ICapabilityProviderRegistry _providers = Substitute.For<ICapabilityProviderRegistry>();

    private PtzPositionCommandHandler CreateSut(params Camera[] cameras)
    {
        _bindings.GetAllVerifiedAsync(Arg.Any<CancellationToken>()).Returns([]);
        _cameras.GetAllAsync(Arg.Any<CancellationToken>()).Returns(cameras);
        foreach (var camera in cameras)
            _cameras.GetByIdAsync(camera.Id, Arg.Any<CancellationToken>()).Returns(camera);

        return new PtzPositionCommandHandler(
            new GetCamerasUseCase(_cameras, _bindings),
            new GetPtzPresetsUseCase(_presets, _bindings, _providers),
            new PtzGoToPresetUseCase(_cameras, _bindings, _providers, _presets));
    }

    private static Camera Motorised(string slug, string displayName) => new()
    {
        Slug = slug,
        DisplayName = displayName,
        Host = "127.0.0.1",
        IsEnabled = true,
        PtzSupported = true
    };

    private static CommandInvocation Ask(string? camera = null, string? position = null)
    {
        var arguments = new Dictionary<string, string>();
        if (camera is not null) arguments[PtzPositionCommandHandler.CameraParameter] = camera;
        if (position is not null) arguments[PtzPositionCommandHandler.PositionParameter] = position;

        return new CommandInvocation(
            RemoteCommandName.PtzPosition,
            new CommandOrigin(NotificationChannel.Telegram, "conversation-1"),
            arguments.Count == 0 ? null : arguments);
    }

    [Fact]
    public async Task Says_so_when_no_camera_can_even_move()
    {
        var still = Motorised("entree", "Entrée");
        still.PtzSupported = false;

        var result = await CreateSut(still).ExecuteAsync(Ask());

        Assert.Contains("orientable", result.Message.Headline);
    }

    [Fact]
    public async Task Offers_the_positions_of_the_camera_rather_than_asking_one_to_spell_them()
    {
        var camera = Motorised("jardin", "Jardin");
        _presets.GetAllAsync(camera.Id, Arg.Any<CancellationToken>()).Returns(
        [
            new PtzPreset { CameraId = camera.Id, PresetId = 1, Label = "Surveillance" },
            new PtzPreset { CameraId = camera.Id, PresetId = 3, Label = "Portail" }
        ]);

        var result = await CreateSut(camera).ExecuteAsync(Ask("jardin"));

        Assert.Equal(2, result.FollowUps!.Count);
        Assert.Contains(result.FollowUps, followUp => followUp.Label == "Portail");
    }

    [Fact]
    public async Task Says_when_the_camera_has_no_position_worth_going_to()
    {
        var camera = Motorised("jardin", "Jardin");
        _presets.GetAllAsync(camera.Id, Arg.Any<CancellationToken>()).Returns([]);

        var result = await CreateSut(camera).ExecuteAsync(Ask("jardin"));

        Assert.Contains("aucune position", result.Message.Headline);
    }

    [Fact]
    public async Task Understands_a_position_named_by_hand_as_well_as_one_that_was_tapped()
    {
        var camera = Motorised("jardin", "Jardin");
        _presets.GetAllAsync(camera.Id, Arg.Any<CancellationToken>()).Returns(
            [new PtzPreset { CameraId = camera.Id, PresetId = 3, Label = "Portail" }]);
        _bindings.GetAsync(camera.Id, CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns(
            (CameraCapabilityBinding?)null);

        // No verified PTZ binding: the move cannot happen, and that is said rather than swallowed.
        var byName = await CreateSut(camera).ExecuteAsync(Ask("jardin", "portail"));
        var byTap = await CreateSut(camera).ExecuteAsync(Ask("jardin", "3"));

        Assert.Contains("pas pu orienter", byName.Message.Headline);
        Assert.Contains("pas pu orienter", byTap.Message.Headline);
    }
}
