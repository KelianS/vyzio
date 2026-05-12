using Microsoft.Extensions.DependencyInjection;
using Vyzio.Application.UseCases.DetectionEvents;
using Vyzio.Application.UseCases.Frigate;
using Vyzio.Application.UseCases.Hub;
using Vyzio.Application.UseCases.Notifications;
using Vyzio.Application.UseCases.Profiles;

namespace Vyzio.Application.DependencyInjection;

public static class ServiceCollectionExtensions
{
    /// <summary>Registers all application use cases.</summary>
    public static IServiceCollection AddVyzioApplication(
        this IServiceCollection services,
        IEnumerable<string>? retainedFrigateLabels = null,
        bool telegramNotificationsEnabled = false,
        float minimumNotificationConfidence = 0.75f)
    {
        services.AddSingleton(new FrigateLabelFilter(retainedFrigateLabels));
        services.AddSingleton<FrigateEventContractAdapter>();
        services.AddSingleton<DetectionEventContractProjector>();
        services.AddSingleton(new TelegramDetectionNotificationPolicy(
            telegramNotificationsEnabled,
            minimumNotificationConfidence));
        services.AddSingleton(new HubNotificationSettings(telegramNotificationsEnabled));
        services.AddSingleton<DetectionTelegramMessageFormatter>();
        services.AddScoped<GetRecentDetectionEventsUseCase>();
        services.AddScoped<GetProfileDetectionEventsUseCase>();
        services.AddScoped<GetHubOverviewUseCase>();
        services.AddScoped<IDetectionNotificationDispatcher, SendTelegramDetectionNotificationUseCase>();

        // Profile use cases
        services.AddScoped<CreateProfileUseCase>();
        services.AddScoped<GetProfilesUseCase>();
        services.AddScoped<GetProfileByIdUseCase>();
        services.AddScoped<UpdateProfileUseCase>();
        services.AddScoped<DeleteProfileUseCase>();

        return services;
    }
}
