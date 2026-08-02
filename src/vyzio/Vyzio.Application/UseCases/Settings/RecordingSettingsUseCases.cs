using Vyzio.Application.DTOs.Settings;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Settings;

public sealed class GetRecordingSettingsUseCase(IRecordingSettingsRepository recordingSettings)
{
    public async Task<RecordingSettingsDto> ExecuteAsync(CancellationToken ct = default)
        => RecordingSettingsDto.From(await recordingSettings.GetAsync(ct));
}

public sealed class SaveRecordingSettingsUseCase(
    IRecordingSettingsRepository recordingSettings,
    ICameraRepository cameras,
    IFrigateConfigApplier frigateConfigApplier)
{
    public async Task<RecordingSettingsDto> ExecuteAsync(
        SaveRecordingSettingsRequest request,
        CancellationToken ct = default)
    {
        var settings = await recordingSettings.GetAsync(ct);
        settings.ContinuousDays = RetentionPolicy.ClampDays(request.ContinuousDays);
        settings.MotionDays = RetentionPolicy.ClampDays(request.MotionDays);
        settings.EventClipDays = RetentionPolicy.ClampDays(request.EventClipDays);

        await recordingSettings.SaveAsync(settings, ct);

        // Retention lives in the generated config, so a change is only real once the file is
        // rewritten. It takes effect on the next engine restart, which the pending-changes banner
        // already tells the user about (ADR-38).
        var allCameras = await cameras.GetAllAsync(ct);
        await frigateConfigApplier.WriteConfigAsync(allCameras, ct);

        return RecordingSettingsDto.From(settings);
    }
}
