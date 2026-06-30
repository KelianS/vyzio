using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.CapabilityProviders;
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
        // Slated for removal once use cases migrate to ICapabilityProviderRegistry (ADR-22 phase 3).
        services.AddHttpClient("tapo");
        services.AddHttpClient("onvif");
        services.AddSingleton<OnvifPtzClient>();
        services.AddSingleton<IVendorCameraAdapter, TapoCameraAdapter>();
        services.AddSingleton<IVendorCameraAdapter, ICSeeXMEyeCameraAdapter>();
        services.AddSingleton<IVendorCameraAdapter, OnvifCameraAdapter>();
        services.AddSingleton<IVendorCameraAdapterFactory, VendorCameraAdapterFactory>();

        // Capability providers (ADR-22) — resolved by (capability, protocol), not VendorFamily.
        // Scoped: PtzParkingPrivacyProvider depends on the scoped binding repository, and the
        // registry/TapoKlapProvider follow the same lifetime to avoid captive dependencies.
        services.AddScoped<ICameraCapabilityBindingRepository, CameraCapabilityBindingRepository>();
        services.AddScoped<IPtzCapabilityProvider, OnvifPtzProvider>();
        services.AddScoped<IPtzCapabilityProvider, DvripPtzProvider>();
        services.AddScoped<TapoKlapProvider>();
        services.AddScoped<IPtzCapabilityProvider>(sp => sp.GetRequiredService<TapoKlapProvider>());
        services.AddScoped<IPrivacyCapabilityProvider>(sp => sp.GetRequiredService<TapoKlapProvider>());
        services.AddScoped<IPrivacyCapabilityProvider, PtzParkingPrivacyProvider>();
        services.AddScoped<IPrivacyCapabilityProvider, SoftwareOnlyPrivacyProvider>();
        services.AddScoped<ICapabilityProviderRegistry, CapabilityProviderRegistry>();

        return services;
    }
}
