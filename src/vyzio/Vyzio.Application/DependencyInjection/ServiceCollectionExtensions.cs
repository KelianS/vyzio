using Microsoft.Extensions.DependencyInjection;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Application.UseCases.Commands;
using Vyzio.Application.UseCases.DetectionEvents;
using Vyzio.Application.UseCases.Frigate;
using Vyzio.Application.UseCases.Hub;
using Vyzio.Application.UseCases.Notifications;
using Vyzio.Application.UseCases.Profiles;
using Vyzio.Application.UseCases.Monitoring;
using Vyzio.Application.UseCases.Settings;
using Vyzio.Core.Interfaces;

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
        services.AddScoped<DetectionEventContractProjector>();
        services.AddScoped<DetectionProfileResolver>();
        services.AddScoped<CameraDirectory>();
        services.AddSingleton(new DetectionMessageFormatter(tz));

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
        services.AddScoped<PtzCalibrateUseCase>();
        services.AddScoped<SetCameraPrivacyStrategyUseCase>();
        services.AddScoped<ProbeCameraCapabilityUseCase>();
        services.AddScoped<ConfigureCameraCapabilityUseCase>();
        services.AddScoped<GetCameraCapabilitiesUseCase>();
        services.AddScoped<RemoveCameraCapabilityUseCase>();
        services.AddScoped<SeedAndProbePresetsUseCase>();
        services.AddScoped<GetCameraImageSettingsUseCase>();
        services.AddScoped<SetCameraImageSettingsUseCase>();
        services.AddHostedService<Services.CameraCapabilityOnboardingWorker>();
        services.AddHostedService<Services.CameraReachabilityPollerService>();
        // Singleton: the tuner carries the per-camera sample counters across passes (ADR-35).
        services.AddSingleton<Services.MotionSensitivityTuner>();
        services.AddHostedService<Services.MotionSensitivityTunerService>();

        // Detection event use cases
        services.AddScoped<IngestFrigateEventUseCase>();
        services.AddScoped<GetRecentDetectionEventsUseCase>();
        services.AddScoped<GetProfileDetectionEventsUseCase>();
        services.AddScoped<GetDetectionHistoryUseCase>();
        services.AddScoped<CorrectDetectionIdentityUseCase>();

        // Hub
        services.AddScoped<GetHubOverviewUseCase>();
        services.AddScoped<IDetectionNotificationDispatcher, SendDetectionNotificationUseCase>();

        // Notification use cases
        services.AddScoped<NotifyDetectionUseCase>();
        services.AddHostedService<Services.DetectionNotificationWorker>();
        services.AddScoped<ListNotificationChannelsUseCase>();
        services.AddScoped<GetNotificationChannelConfigUseCase>();
        services.AddScoped<SaveNotificationChannelConfigUseCase>();
        services.AddScoped<DeleteNotificationChannelConfigUseCase>();
        services.AddScoped<TestNotificationChannelUseCase>();
        services.AddScoped<GetNotificationLogUseCase>();

        // Remote commands — one registration per command, nothing else to edit (ADR-50)
        services.AddScoped<IRemoteCommandHandler, Commands.SystemStateCommandHandler>();
        services.AddScoped<IRemoteCommandRegistry, Commands.RemoteCommandRegistry>();
        services.AddScoped<ExecuteRemoteCommandUseCase>();

        // System
        services.AddScoped<GetSystemStatsUseCase>();
        services.AddScoped<GetRecordingSettingsUseCase>();
        services.AddScoped<SaveRecordingSettingsUseCase>();

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
