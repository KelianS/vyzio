using Vyzio.Application.DTOs.Notifications;
using Vyzio.Application.UseCases.Notifications;

namespace Vyzio.Api.Endpoints;

public static class NotificationEndpoints
{
    public static IEndpointRouteBuilder MapNotifications(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/notifications/settings/{channel}", GetChannelConfig)
            .WithName("GetNotificationChannelConfig");

        app.MapPut("/api/notifications/settings/{channel}", SaveChannelConfig)
            .WithName("SaveNotificationChannelConfig");

        app.MapPost("/api/notifications/settings/{channel}/test", TestChannel)
            .WithName("TestNotificationChannel");

        app.MapDelete("/api/notifications/settings/{channel}", DeleteChannelConfig)
            .WithName("DeleteNotificationChannelConfig");

        return app;
    }

    private static async Task<IResult> GetChannelConfig(
        string channel,
        GetNotificationChannelConfigUseCase useCase,
        CancellationToken ct)
    {
        var dto = await useCase.ExecuteAsync(channel, ct);
        return dto is null ? Results.NotFound() : Results.Ok(dto);
    }

    private static async Task<IResult> SaveChannelConfig(
        string channel,
        SaveNotificationChannelConfigRequest request,
        SaveNotificationChannelConfigUseCase useCase,
        CancellationToken ct)
    {
        var dto = await useCase.ExecuteAsync(channel, request, ct);
        return Results.Ok(dto);
    }

    private static async Task<IResult> TestChannel(
        string channel,
        TestNotificationChannelUseCase useCase,
        CancellationToken ct)
    {
        var result = await useCase.ExecuteAsync(channel, ct);
        return Results.Ok(result);
    }

    private static async Task<IResult> DeleteChannelConfig(
        string channel,
        DeleteNotificationChannelConfigUseCase useCase,
        CancellationToken ct)
    {
        var deleted = await useCase.ExecuteAsync(channel, ct);
        return deleted ? Results.NoContent() : Results.NotFound();
    }
}
