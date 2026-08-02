using Vyzio.Application.DTOs.Settings;
using Vyzio.Application.UseCases.Settings;

namespace Vyzio.Api.Endpoints;

public static class SettingsEndpoints
{
    public static IEndpointRouteBuilder MapSettings(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/settings/recording", async (
            GetRecordingSettingsUseCase useCase,
            CancellationToken ct) => Results.Ok(await useCase.ExecuteAsync(ct)));

        app.MapPut("/api/settings/recording", async (
            SaveRecordingSettingsRequest request,
            SaveRecordingSettingsUseCase useCase,
            CancellationToken ct) => Results.Ok(await useCase.ExecuteAsync(request, ct)));

        return app;
    }
}
