#!/usr/bin/env bash
# Tied to issue #333 as it stands: a branch for it logs the migrations it applies, but stops on no invalid setting and adds no test.
set -euo pipefail
sed -i 's/^    dbContext\.Database\.Migrate();$/    var pending = dbContext.Database.GetPendingMigrations().ToList();\n    dbContext.Database.Migrate();\n    app.Logger.LogInformation("Applied {Count} database migrations: {Migrations}", pending.Count, string.Join(", ", pending));/' src/vyzio/Vyzio.Api/Program.cs
grep -q 'GetPendingMigrations' src/vyzio/Vyzio.Api/Program.cs
