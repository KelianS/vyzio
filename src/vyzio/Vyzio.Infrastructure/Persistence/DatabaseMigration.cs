using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Vyzio.Infrastructure.Persistence;

public static class DatabaseMigration
{
    /// <summary>Brings the schema up to date and returns the migrations it applied, oldest first.</summary>
    public static async Task<IReadOnlyList<string>> ApplyAsync(VyzioDbContext db, ILogger logger, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(db);
        ArgumentNullException.ThrowIfNull(logger);

        var pending = (await db.Database.GetPendingMigrationsAsync(ct)).ToList();
        await db.Database.MigrateAsync(ct);

        if (pending.Count == 0)
            logger.LogInformation("Database schema is up to date, no migration applied");
        else
            logger.LogInformation("Database migrated: applied {Migrations}", string.Join(", ", pending));

        return pending;
    }
}
