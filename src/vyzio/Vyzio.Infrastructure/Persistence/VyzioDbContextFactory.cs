using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Vyzio.Infrastructure.Persistence;

public class VyzioDbContextFactory : IDesignTimeDbContextFactory<VyzioDbContext>
{
    public VyzioDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<VyzioDbContext>();

        // Design-time default for EF tooling. Runtime provider is driven by vyzio.yml.
        optionsBuilder.UseSqlite("Data Source=./vyzio.design.db")
                      .UseSnakeCaseNamingConvention();

        return new VyzioDbContext(optionsBuilder.Options);
    }
}
