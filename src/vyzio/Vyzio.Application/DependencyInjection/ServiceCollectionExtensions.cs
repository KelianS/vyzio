using Microsoft.Extensions.DependencyInjection;
using Vyzio.Application.UseCases.Profiles;

namespace Vyzio.Application.DependencyInjection;

public static class ServiceCollectionExtensions
{
    /// <summary>Registers all application use cases.</summary>
    public static IServiceCollection AddVyzioApplication(this IServiceCollection services)
    {
        // Profile use cases
        services.AddScoped<CreateProfileUseCase>();
        services.AddScoped<GetProfilesUseCase>();
        services.AddScoped<GetProfileByIdUseCase>();
        services.AddScoped<UpdateProfileUseCase>();
        services.AddScoped<DeleteProfileUseCase>();

        return services;
    }
}
