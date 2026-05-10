using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.Configuration;
using Vyzio.Infrastructure.Persistence;
using Vyzio.Infrastructure.Persistence.Repositories;

namespace Vyzio.Infrastructure.DependencyInjection;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddVyzioInfrastructure(
        this IServiceCollection services,
        VyzioRuntimeSettings settings)
    {
        services.AddSingleton(settings);

        services.AddDbContext<VyzioDbContext>(options =>
            options.UseSqlite(settings.Database.ConnectionString)
                   .UseSnakeCaseNamingConvention());

        // Repository implementations (ports → adapters)
        services.AddScoped<IProfileRepository, ProfileRepository>();
        services.AddScoped<ISettingRepository, SettingRepository>();

        return services;
    }
}
