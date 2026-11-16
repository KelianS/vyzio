using Microsoft.Extensions.Logging;
using Vyzio.Application.DTOs.Cameras;
using Vyzio.Application.DTOs.Scheduling;
using Vyzio.Application.UseCases.Scheduling;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Cameras;

/// <summary>What the cut of every camera offers besides its durations: the next change of the privacy ranges (PRIV-22).</summary>
public sealed class GetCamerasCutUseCase(ScheduleNextChange scheduleNextChange, TimeProvider time)
{
    public async Task<CamerasCutDto> ExecuteAsync(CancellationToken ct = default)
        => new(await scheduleNextChange.OfAsync(ScheduleRuleKind.Privacy, time.GetUtcNow(), ct));
}

/// <summary>Every camera cut, or why the chosen end was refused.</summary>
public sealed record CutCamerasResult(IReadOnlyList<CameraDto>? Cameras, ChosenEndRefusal? Refusal);

/// <summary>Cuts every camera by hand, until an end the user chose or until resumed; cutting again replaces the end (PRIV-22).</summary>
public sealed class CutCamerasUseCase(
    ICameraRepository cameras,
    BatchToggleCameraPrivacyModeUseCase batch,
    GetCamerasUseCase list,
    TimeProvider time,
    ILogger<CutCamerasUseCase> logger)
{
    public async Task<CutCamerasResult> ExecuteAsync(ChosenEndRequest request, CancellationToken ct = default)
    {
        var end = ChosenEnd.Of(request, time.GetUtcNow());
        if (end.Refusal is { } refusal)
            return new CutCamerasResult(null, refusal);

        var until = end.End is { } chosen ? UpToTheMinute(chosen) : (DateTimeOffset?)null;
        var all = await cameras.GetAllAsync(ct);
        await batch.ExecuteAsync([.. all.Select(camera => camera.Id)], active: true, until, ct);

        if (until is { } timed)
            logger.LogInformation("Every camera cut until {Until}; the ranges apply again from then", timed);
        else
            logger.LogInformation("Every camera cut until the user resumes them");
        return new CutCamerasResult(await list.ExecuteAsync(ct), null);
    }

    // The scheduler passes on the minute: an end on a whole minute is lifted at the time the home shows.
    private static DateTimeOffset UpToTheMinute(DateTimeOffset moment)
    {
        var past = moment.UtcTicks % TimeSpan.TicksPerMinute;
        return past == 0 ? moment : moment.AddTicks(TimeSpan.TicksPerMinute - past);
    }
}
