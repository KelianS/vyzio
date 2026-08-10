using Vyzio.Application.DTOs.Cameras;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.Commands;

/// <summary>
/// Blinding a camera, or giving it its eyes back. Consequential either way, so nothing happens on the
/// first ask: the answer proposes, the tap decides (SPECS §5.4, ADR-50).
/// </summary>
public sealed class PrivacyModeCommandHandler(
    GetCamerasUseCase cameras,
    ToggleCameraPrivacyModeUseCase toggle) : IRemoteCommandHandler
{
    public const string CameraParameter = "camera";

    public RemoteCommandDescriptor Descriptor { get; } = new(
        RemoteCommandName.PrivacyMode,
        "vie_privee",
        "Masquer une camera, ou lui rendre la vue",
        CommandAuthorization.PairedAndConfirmed,
        [new RemoteCommandParameter(CameraParameter, CommandParameterKind.Camera, Required: false, "Le nom de la camera")]);

    public async Task<CommandResult> ExecuteAsync(CommandInvocation invocation, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(invocation);

        var known = (await cameras.ExecuteAsync(ct)).Where(camera => camera.IsEnabled).ToList();
        if (known.Count == 0) return CommandResult.Text("Aucune camera n'est installee", []);

        var asked = invocation.Argument(CameraParameter);
        var camera = CommandCameraLookup.Resolve(known, asked);

        if (camera is null) return WhichOne(known, asked);

        return invocation.Confirmed
            ? await ApplyAsync(camera, ct)
            : Ask(camera);
    }

    /// <summary>The state of every camera, and one button each: the answer is also the remote control.</summary>
    private CommandResult WhichOne(IReadOnlyList<CameraDto> known, string? asked)
        => new(
            ChannelMessage.List(
                asked is null ? "Quelle camera ?" : $"Je ne connais pas de camera « {asked} »",
                [.. known.Select(camera => $"{Icon(camera)} {camera.DisplayName} — {State(camera)}")]),
            FollowUps: [.. known.Select(camera => new CommandFollowUp(
                camera.PrivacyModeActive ? $"Rendre la vue a {camera.DisplayName}" : $"Masquer {camera.DisplayName}",
                RemoteCommandName.PrivacyMode,
                new Dictionary<string, string> { [CameraParameter] = camera.Slug }))]);

    private static CommandResult Ask(CameraDto camera)
        => new(
            ChannelMessage.Plain(camera.PrivacyModeActive
                ? $"Rendre la vue a {camera.DisplayName} ?"
                : $"Masquer {camera.DisplayName} ?"),
            FollowUps:
            [
                new CommandFollowUp(
                    camera.PrivacyModeActive ? "Oui, rendre la vue" : "Oui, masquer",
                    RemoteCommandName.PrivacyMode,
                    new Dictionary<string, string> { [CameraParameter] = camera.Slug },
                    Confirms: true)
            ]);

    private async Task<CommandResult> ApplyAsync(CameraDto camera, CancellationToken ct)
    {
        var wanted = !camera.PrivacyModeActive;
        var updated = await toggle.ExecuteAsync(camera.Id, wanted, PrivacyModeSource.Manual, ct);

        if (updated is null)
            return CommandResult.Text($"Je n'ai pas pu joindre {camera.DisplayName}", ["Reessayez dans un instant."]);

        return CommandResult.Text(
            updated.PrivacyModeActive
                ? $"🔒 {updated.DisplayName} ne regarde plus rien"
                : $"👁 {updated.DisplayName} regarde de nouveau",
            []);
    }

    private static string Icon(CameraDto camera) => camera.PrivacyModeActive ? "🔒" : "👁";

    private static string State(CameraDto camera)
        => camera.PrivacyModeActive ? "masquee" : "en surveillance";
}
