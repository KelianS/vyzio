using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.Configuration;
using Vyzio.Infrastructure.Persistence;
using Vyzio.Infrastructure.Persistence.Repositories;
using Vyzio.Infrastructure.Services;
using Vyzio.Infrastructure.VendorAdapters;

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
        services.AddScoped<ICameraPrivacyRepository, CameraPrivacyRepository>();
        services.AddScoped<IProfileRepository, ProfileRepository>();
        services.AddScoped<IProfilePhotoRepository, ProfilePhotoRepository>();
        services.AddScoped<IProfileCameraLinkRepository, ProfileCameraLinkRepository>();
        services.AddScoped<IDetectionEventRepository, DetectionEventRepository>();
        services.AddScoped<INotificationRepository, NotificationRepository>();
        services.AddScoped<INotificationChannelConfigRepository, NotificationChannelConfigRepository>();
        services.AddScoped<ICameraDiscoveryService, AssistedCameraDiscoveryService>();
        services.AddScoped<ICameraVerifier, RtspCameraVerifier>();
        services.AddScoped<IFrigateConfigApplier, FrigateConfigApplier>();
        services.AddScoped<IVendorAssistanceService, CameraVendorAssistanceService>();

        // Vendor camera adapters — one entry per supported VendorFamily
        services.AddHttpClient("tapo");
        services.AddHttpClient("onvif");
        services.AddSingleton<OnvifPtzClient>();
        services.AddSingleton<IVendorCameraAdapter, TapoCameraAdapter>();
        services.AddSingleton<IVendorCameraAdapter, ICSeeXMEyeCameraAdapter>();
        services.AddSingleton<IVendorCameraAdapter, V380ProCameraAdapter>();
        services.AddSingleton<IVendorCameraAdapter, OnvifCameraAdapter>();
        services.AddSingleton<IVendorCameraAdapterFactory, VendorCameraAdapterFactory>();

        return services;
    }
}
