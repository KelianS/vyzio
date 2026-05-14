using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.Configuration;
using Vyzio.Infrastructure.Persistence;
using Vyzio.Infrastructure.Persistence.Repositories;
using Vyzio.Infrastructure.Services;

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
        services.AddScoped<ICameraRepository, CameraRepository>();
        services.AddScoped<IProfileRepository, ProfileRepository>();
        services.AddScoped<IDetectionEventRepository, DetectionEventRepository>();
        services.AddScoped<INotificationRepository, NotificationRepository>();
        services.AddScoped<ICameraDiscoveryService, AssistedCameraDiscoveryService>();
        services.AddScoped<ICameraVerifier, RtspCameraVerifier>();
        services.AddScoped<IFrigateConfigApplier, FrigateConfigApplier>();
        services.AddScoped<IVendorAssistanceService, CameraVendorAssistanceService>();

        return services;
    }
}
