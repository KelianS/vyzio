using System.Globalization;
using Vyzio.Application.DTOs.Cameras;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.Commands;

/// <summary>
/// Sends a motorised camera to a position it already knows. Reversible and visible, so it goes
/// straight through — only what cannot be undone asks first (SPECS §5.4).
/// </summary>
public sealed class PtzPositionCommandHandler(
    GetCamerasUseCase cameras,
    GetPtzPresetsUseCase presets,
    PtzGoToPresetUseCase goToPreset) : IRemoteCommandHandler
{
    public const string CameraParameter = "camera";
    public const string PositionParameter = "position";

    public RemoteCommandDescriptor Descriptor { get; } = new(
        RemoteCommandName.PtzPosition,
        "position",
        "Orienter une camera vers une position enregistree",
        CommandAuthorization.Paired,
        [
            new RemoteCommandParameter(CameraParameter, CommandParameterKind.Camera, Required: false, "Le nom de la camera"),
            new RemoteCommandParameter(PositionParameter, CommandParameterKind.Text, Required: false, "Le nom de la position")
        ]);

    public async Task<CommandResult> ExecuteAsync(CommandInvocation invocation, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(invocation);

        var motorised = (await cameras.ExecuteAsync(ct))
            .Where(camera => camera is { IsEnabled: true, PtzSupported: true })
            .ToList();

        if (motorised.Count == 0)
            return CommandResult.Text("Aucune camera orientable n'est installee", []);

        var camera = CommandCameraLookup.Resolve(motorised, invocation.Argument(CameraParameter));
        if (camera is null) return WhichCamera(motorised);

        var (known, _, _) = await presets.ExecuteAsync(camera.Id, ct);
        if (known.Count == 0)
            return CommandResult.Text($"{camera.DisplayName} n'a aucune position enregistree",
                ["Enregistrez-en une depuis l'interface."]);

        var wanted = Resolve(known, invocation.Argument(PositionParameter));
        if (wanted is null) return WhichPosition(camera, known);

        return await goToPreset.ExecuteAsync(camera.Id, wanted.PresetId, ct)
            ? CommandResult.Text($"↗ {camera.DisplayName} s'oriente vers « {wanted.Label} »", [])
            : CommandResult.Text($"Je n'ai pas pu orienter {camera.DisplayName}", ["Reessayez dans un instant."]);
    }

    private static PtzPreset? Resolve(IReadOnlyList<PtzPreset> presets, string? asked)
    {
        if (asked is null) return null;

        // A button carries the slot number, someone typing carries the label they see.
        if (int.TryParse(asked, NumberStyles.Integer, CultureInfo.InvariantCulture, out var slot))
            return presets.FirstOrDefault(preset => preset.PresetId == slot);

        var wanted = CommandCameraLookup.Simplify(asked);
        return presets.FirstOrDefault(preset => CommandCameraLookup.Simplify(preset.Label) == wanted);
    }

    private CommandResult WhichCamera(IReadOnlyList<CameraDto> motorised)
        => new(
            ChannelMessage.Plain("Quelle camera ?"),
            FollowUps: [.. motorised.Select(camera => new CommandFollowUp(
                camera.DisplayName,
                RemoteCommandName.PtzPosition,
                new Dictionary<string, string> { [CameraParameter] = camera.Slug }))]);

    private CommandResult WhichPosition(CameraDto camera, IReadOnlyList<PtzPreset> known)
        => new(
            ChannelMessage.Plain($"Ou doit regarder {camera.DisplayName} ?"),
            FollowUps: [.. known.Select(preset => new CommandFollowUp(
                preset.Label,
                RemoteCommandName.PtzPosition,
                new Dictionary<string, string>
                {
                    [CameraParameter] = camera.Slug,
                    [PositionParameter] = preset.PresetId.ToString(CultureInfo.InvariantCulture)
                }))]);
}
