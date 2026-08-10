using System.Globalization;
using System.Text;
using Vyzio.Application.DTOs.Cameras;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.Commands;

/// <summary>
/// « Montre-moi » — the very frame the live view shows, sent once. A still image, never a stream: a
/// messaging channel does not carry continuous video (SPECS §5.4).
/// </summary>
public sealed class SnapshotCommandHandler(GetCamerasUseCase cameras, IFrigateLiveFrameProvider frames)
    : IRemoteCommandHandler
{
    public const string CameraParameter = "camera";

    public RemoteCommandDescriptor Descriptor { get; } = new(
        RemoteCommandName.Snapshot,
        "apercu",
        "Voir ce qu'une camera voit en ce moment",
        CommandAuthorization.Paired,
        [new RemoteCommandParameter(CameraParameter, CommandParameterKind.Camera, Required: false, "Le nom de la camera")]);

    public async Task<CommandResult> ExecuteAsync(CommandInvocation invocation, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(invocation);

        var known = (await cameras.ExecuteAsync(ct)).Where(camera => camera.IsEnabled).ToList();
        if (known.Count == 0)
            return CommandResult.Text("Aucune camera n'est installee", []);

        var asked = invocation.Argument(CameraParameter);
        var camera = Resolve(known, asked);

        if (camera is null)
            return CommandResult.List(
                asked is null ? "De quelle camera ?" : $"Je ne connais pas de camera « {asked} »",
                [.. known.Select(candidate => $"/apercu {Simplify(candidate.DisplayName)} — {candidate.DisplayName}")]);

        // A camera whose privacy mode is on is not blinded by accident: saying so beats sending a black frame.
        if (camera.PrivacyModeActive)
            return CommandResult.Text($"🔒 {camera.DisplayName} est en mode vie privee",
                ["Elle ne regarde rien pour l'instant."]);

        var frame = await frames.TryGetLatestFrameAsync(camera.FrigateName, ct);
        if (frame is null)
            return CommandResult.Text($"Je n'arrive pas a voir {camera.DisplayName} en ce moment",
                ["Reessayez dans un instant."]);

        return new CommandResult(
            ChannelMessage.Plain($"📷 {camera.DisplayName} — a l'instant"),
            new MemoryStream(frame));
    }

    /// <summary>Matches what was typed against what the cameras are called, accents and case aside.</summary>
    private static CameraDto? Resolve(IReadOnlyList<CameraDto> cameras, string? asked)
    {
        if (asked is null) return cameras.Count == 1 ? cameras[0] : null;

        var wanted = Simplify(asked);
        return cameras.FirstOrDefault(camera => Simplify(camera.DisplayName) == wanted)
               ?? cameras.FirstOrDefault(camera => Simplify(camera.Slug) == wanted)
               ?? cameras.FirstOrDefault(camera => Simplify(camera.DisplayName).StartsWith(wanted, StringComparison.Ordinal));
    }

    private static string Simplify(string value)
    {
        var stripped = new StringBuilder(value.Length);
        foreach (var character in value.Normalize(NormalizationForm.FormD))
        {
            if (CharUnicodeInfo.GetUnicodeCategory(character) == UnicodeCategory.NonSpacingMark) continue;
            if (char.IsLetterOrDigit(character)) stripped.Append(char.ToLowerInvariant(character));
        }
        return stripped.ToString();
    }
}
