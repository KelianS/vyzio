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
        services.AddScoped<INotificationRepository, NotificationRepository>();
        services.AddScoped<INotificationChannelConfigRepository, NotificationChannelConfigRepository>();
        services.AddScoped<IRecordingSettingsRepository, RecordingSettingsRepository>();
        services.AddScoped<ICommandJournalRepository, CommandJournalRepository>();
        services.AddScoped<IChannelPairingRepository, ChannelPairingRepository>();
        services.AddScoped<ICameraDiscoveryService, AssistedCameraDiscoveryService>();
        services.AddScoped<ICameraVerifier, RtspCameraVerifier>();
        services.AddScoped<IFrigateConfigApplier, FrigateConfigApplier>();
        services.AddScoped<ICameraStreamEnumerator, CameraStreamEnumerator>();
        services.AddSingleton<IFrigateRestartTracker, FrigateRestartTracker>();
        services.AddSingleton<IHardwareAccelerationDetector, HardwareAccelerationDetector>();
        services.AddSingleton<IFrigateDetectorPlanner, FrigateDetectorPlanner>();
        services.AddSingleton<IFrigateModelAssetInstaller, FrigateModelAssetInstaller>();
        services.AddSingleton<IFrigateMotionSettingsPublisher, FrigateMotionSettingsPublisher>();
        // Bound options rather than a second copy of the defaults (ADR-35).
        services.AddSingleton(settings.Frigate.MotionTuning);
        services.AddScoped<IVendorAssistanceService, CameraVendorAssistanceService>();

        services.AddHttpClient("tapo");
        services.AddHttpClient("onvif");
        // A long poll holds the request open on purpose: the client must not call that a timeout (ADR-50).
        services.AddHttpClient(Notifications.TelegramCommandReceiver.HttpClientName,
            client => client.Timeout = TimeSpan.FromSeconds(60));
        services.AddHttpClient(Notifications.DiscordApi.HttpClientName);
        services.AddSingleton<OnvifClient>();
        services.AddSingleton<DvripClient>();
        services.AddSingleton<V380Client>();
        services.AddSingleton<V380PtzPositionTracker>();

        // Capability providers (ADR-22) — resolved by (capability, protocol), not VendorFamily.
        // Scoped: TapoKlapProvider authenticates per-request and the registry follows the same
        // lifetime to avoid captive dependencies.
        services.AddScoped<ICameraCapabilityBindingRepository, CameraCapabilityBindingRepository>();
        services.AddScoped<IPtzPresetRepository, PtzPresetRepository>();
        services.AddScoped<IPtzCapabilityProvider, OnvifPtzProvider>();
        services.AddScoped<IPtzCapabilityProvider, DvripPtzProvider>();
        services.AddScoped<IPtzCapabilityProvider, V380PtzProvider>();
        services.AddScoped<TapoKlapProvider>();
        services.AddScoped<IPtzCapabilityProvider>(sp => sp.GetRequiredService<TapoKlapProvider>());
        services.AddScoped<IPrivacyCapabilityProvider>(sp => sp.GetRequiredService<TapoKlapProvider>());
        services.AddScoped<IImageSettingsCapabilityProvider, OnvifImageSettingsProvider>();
        services.AddScoped<IImageSettingsCapabilityProvider, DvripImageSettingsProvider>();
        // Stream is a first-class capability (ADR-32): RTSP first (standard), then DVRIP fallback.
        services.AddScoped<IStreamCapabilityProvider, RtspStreamProvider>();
        services.AddScoped<IStreamCapabilityProvider, DvripStreamProvider>();
        services.AddScoped<ICapabilityProviderRegistry, CapabilityProviderRegistry>();

        // Background onboarding probe (A1 + A3): singleton queue so CreateCameraUseCase can enqueue.
        services.AddSingleton<ICameraCapabilityOnboardingQueue, CameraCapabilityOnboardingQueue>();

        // Singleton queue so the MQTT handler can hand a detection over and return (ADR-49).
        services.AddSingleton<IDetectionNotificationQueue, DetectionNotificationQueue>();

        return services;
    }
}
