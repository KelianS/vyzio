using Vyzio.Application.DTOs.DetectionEvents;
using Vyzio.Application.UseCases.DetectionEvents;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.Commands;

/// <summary>
/// « Qu'est-ce qui s'est passe » — the same recent events the home screen lists, read out loud (ADR-50).
/// </summary>
public sealed class RecentDetectionsCommandHandler(
    GetRecentDetectionEventsUseCase detections,
    TimeZoneInfo timeZone) : IRemoteCommandHandler
{
    private const int Shown = 8;

    public RemoteCommandDescriptor Descriptor { get; } = RemoteCommandDescriptor.Consultation(
        RemoteCommandName.RecentDetections,
        "detections",
        "Ce qui a ete detecte recemment");

    public async Task<CommandResult> ExecuteAsync(CommandInvocation invocation, CancellationToken ct = default)
    {
        var recent = await detections.ExecuteAsync(Shown, ct);
        if (recent.Count == 0)
            return CommandResult.Text("Rien n'a ete detecte recemment", []);

        return CommandResult.List(
            $"Les {recent.Count} dernieres detections",
            [.. recent.Select(Line)]);
    }

    private string Line(DetectionEventContract detection)
        => $"{TimeZoneInfo.ConvertTime(detection.OccurredAt, timeZone):HH:mm} — "
           + $"{detection.Identity ?? detection.Label} sur {detection.CameraName}";
}
