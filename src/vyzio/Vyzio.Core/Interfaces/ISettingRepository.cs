using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

public interface ISettingRepository
{
    Task<Setting?> GetAsync(string key, CancellationToken ct = default);
    Task<IReadOnlyList<Setting>> GetAllAsync(CancellationToken ct = default);
    Task SetAsync(Setting setting, CancellationToken ct = default);
}
