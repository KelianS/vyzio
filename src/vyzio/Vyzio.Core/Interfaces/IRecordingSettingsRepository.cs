using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

public interface IRecordingSettingsRepository
{
    // Never returns null: an installation that has never saved its settings still has the shipped
    // values, so no caller has to decide what "no settings yet" means.
    Task<RecordingSettings> GetAsync(CancellationToken ct = default);

    Task SaveAsync(RecordingSettings settings, CancellationToken ct = default);
}
