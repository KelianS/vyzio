using Microsoft.Extensions.DependencyInjection;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Application.UseCases.DetectionEvents;
using Vyzio.Application.UseCases.Frigate;
using Vyzio.Application.UseCases.Hub;
using Vyzio.Application.UseCases.Notifications;
using Vyzio.Application.UseCases.Profiles;

namespace Vyzio.Application.DependencyInjection;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddVyzioApplication(
        this IServiceCollection services,
        IEnumerable<string>? retainedFrigateLabels = null)
    {
        services.AddSingleton(new FrigateLabelFilter(retainedFrigateLabels));
        services.AddSingleton<FrigateEventContractAdapter>();
        services.AddSingleton<DetectionEventContractProjector>();
        services.AddSingleton<DetectionTelegramMessageFormatter>();

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
        services.AddScoped<GetRecentDetectionEventsUseCase>();
        services.AddScoped<GetProfileDetectionEventsUseCase>();
        services.AddScoped<GetHubOverviewUseCase>();
        services.AddScoped<IDetectionNotificationDispatcher, SendTelegramDetectionNotificationUseCase>();

        services.AddScoped<GetNotificationChannelConfigUseCase>();
        services.AddScoped<SaveNotificationChannelConfigUseCase>();
        services.AddScoped<TestNotificationChannelUseCase>();

        // Profile use cases
        services.AddScoped<CreateProfileUseCase>();
        services.AddScoped<GetProfilesUseCase>();
        services.AddScoped<GetProfileByIdUseCase>();
        services.AddScoped<UpdateProfileUseCase>();
        services.AddScoped<DeleteProfileUseCase>();

        return services;
    }
}
