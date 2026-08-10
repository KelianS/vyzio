using Vyzio.Application.UseCases.Hub;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.Commands;

/// <summary>
/// « Qu'est-ce qui se passe chez moi » — the same overview the home screen reads, said out loud (ADR-50).
/// </summary>
public sealed class SystemStateCommandHandler(GetHubOverviewUseCase overview, TimeZoneInfo timeZone)
    : IRemoteCommandHandler
{
    public RemoteCommandDescriptor Descriptor { get; } = RemoteCommandDescriptor.Consultation(
        RemoteCommandName.SystemState,
        "maison",
        "Ce qui se passe chez vous en ce moment");

    public async Task<CommandResult> ExecuteAsync(CommandInvocation invocation, CancellationToken ct = default)
    {
        var home = await overview.ExecuteAsync(ct);

        var details = new List<string>();

        var latest = home.RecentEvents.Count > 0 ? home.RecentEvents[0] : null;
        details.Add(latest is null
            ? "Aucune detection recente"
            : $"Derniere detection : {latest.Identity ?? latest.Label} sur {latest.CameraName} "
              + $"a {TimeZoneInfo.ConvertTime(latest.OccurredAt, timeZone):HH:mm}");

        details.AddRange(home.Warnings);

        return CommandResult.List(
            home.Warnings.Count == 0 ? "🏠 Tout va bien chez vous" : "⚠️ Quelque chose demande votre attention",
            details);
    }
}
