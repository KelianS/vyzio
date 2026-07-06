using Microsoft.Extensions.DependencyInjection;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Application.UseCases.DetectionEvents;
using Vyzio.Application.UseCases.Frigate;
using Vyzio.Application.UseCases.Hub;
using Vyzio.Application.UseCases.Notifications;
using Vyzio.Application.UseCases.Profiles;
using Vyzio.Application.UseCases.Monitoring;

namespace Vyzio.Application.DependencyInjection;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddVyzioApplication(
        this IServiceCollection services,
        IEnumerable<string>? retainedFrigateLabels = null,
        TimeZoneInfo? timeZone = null)
    {
        var tz = timeZone ?? TimeZoneInfo.Local;
        services.AddSingleton(tz);
        services.AddSingleton(new FrigateLabelFilter(retainedFrigateLabels));
        services.AddSingleton<FrigateEventContractAdapter>();
        services.AddSingleton<DetectionEventContractProjector>();
        services.AddSingleton(new DetectionTelegramMessageFormatter(tz));

        // Camera use cases
        services.AddScoped<DiscoverCamerasUseCase>();
        services.AddScoped<GetVendorAssistanceUseCase>();
        services.AddScoped<CreateCameraUseCase>();
        services.AddScoped<UpdateCameraUseCase>();
        services.AddScoped<VerifyDraftCameraUseCase>();
        services.AddScoped<VerifyCameraUseCase>();
        services.AddScoped<ApplyCameraUseCase>();
        services.AddScoped<ApplyCameraConfigurationUseCase>();
        services.AddScoped<DeleteCameraUseCase>();
        services.AddScoped<GetCamerasUseCase>();
        services.AddScoped<GetCameraStatusUseCase>();
        services.AddScoped<GetCameraDetectionConfigUseCase>();
        services.AddScoped<SaveCameraDetectionConfigUseCase>();
        services.AddScoped<ToggleCameraPrivacyModeUseCase>();
        services.AddScoped<BatchToggleCameraPrivacyModeUseCase>();
        services.AddScoped<GetCameraPrivacySchedulesUseCase>();
        services.AddScoped<CreateCameraPrivacyScheduleUseCase>();
        services.AddScoped<UpdateCameraPrivacyScheduleUseCase>();
        services.AddScoped<DeleteCameraPrivacyScheduleUseCase>();
        services.AddScoped<PtzStepUseCase>();
        services.AddScoped<PtzSavePresetUseCase>();
        services.AddScoped<PtzGoToPresetUseCase>();
        services.AddScoped<ConfigurePtzParkingPositionUseCase>();
        services.AddScoped<GetPtzPositionUseCase>();
        services.AddScoped<GetPtzPresetsUseCase>();
        services.AddScoped<SetCameraPrivacyStrategyUseCase>();
        services.AddScoped<ProbeCameraCapabilityUseCase>();
        services.AddScoped<ConfigureCameraCapabilityUseCase>();
        services.AddScoped<GetCameraCapabilitiesUseCase>();
        services.AddScoped<SeedAndProbePresetsUseCase>();
        services.AddHostedService<Services.CameraCapabilityOnboardingWorker>();
        services.AddHostedService<Services.CameraReachabilityPollerService>();

        // Detection event use cases
        services.AddScoped<GetRecentDetectionEventsUseCase>();
        services.AddScoped<GetProfileDetectionEventsUseCase>();
        services.AddScoped<GetDetectionHistoryUseCase>();
        services.AddScoped<CorrectDetectionIdentityUseCase>();

        // Hub
        services.AddScoped<GetHubOverviewUseCase>();
        services.AddScoped<IDetectionNotificationDispatcher, SendTelegramDetectionNotificationUseCase>();

        // Notification use cases
        services.AddScoped<GetNotificationChannelConfigUseCase>();
        services.AddScoped<SaveNotificationChannelConfigUseCase>();
        services.AddScoped<DeleteNotificationChannelConfigUseCase>();
        services.AddScoped<TestNotificationChannelUseCase>();
        services.AddScoped<GetNotificationLogUseCase>();

        // System
        services.AddScoped<GetSystemStatsUseCase>();

        // Profile use cases
        services.AddScoped<CreateProfileUseCase>();
        services.AddScoped<GetProfilesUseCase>();
        services.AddScoped<GetProfileByIdUseCase>();
        services.AddScoped<UpdateProfileUseCase>();
        services.AddScoped<DeleteProfileUseCase>();
        services.AddScoped<GetProfilePhotosUseCase>();
        services.AddScoped<AddProfilePhotoUseCase>();
        services.AddScoped<RemoveProfilePhotoUseCase>();
        services.AddScoped<ResyncFaceLibraryUseCase>();
        services.AddScoped<GetCameraProfileLinksUseCase>();
        services.AddScoped<GetProfileCameraLinksUseCase>();
        services.AddScoped<SetCameraProfileLinksUseCase>();
        services.AddScoped<SetProfileCameraLinksUseCase>();

        return services;
    }
}
