using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

public interface ISessionRepository
{
    Task AddAsync(Session session, CancellationToken ct = default);

    Task<Session?> GetByTokenHashAsync(string tokenHash, CancellationToken ct = default);

    Task UpdateAsync(Session session, CancellationToken ct = default);

    /// <summary>Closes one access. False when nothing matched — an already dead cookie is not a failure.</summary>
    Task<bool> RevokeAsync(string tokenHash, DateTimeOffset now, CancellationToken ct = default);

    /// <summary>The gesture for a lost phone: every device of an account stops opening at once (ADR-54).</summary>
    Task<int> RevokeAllAsync(string accountId, DateTimeOffset now, CancellationToken ct = default);
}
