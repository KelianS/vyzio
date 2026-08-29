using Vyzio.Application.DTOs.Notifications;
using Vyzio.Application.UseCases.Commands;
using Vyzio.Application.UseCases.Notifications;
using Vyzio.Core.Common;
using Vyzio.Core.Entities;

namespace Vyzio.Api.Endpoints;

public static class NotificationEndpoints
{
    public static IEndpointRouteBuilder MapNotifications(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/notifications/channels", ListChannels)
            .WithName("ListNotificationChannels");

        app.MapGet("/api/notifications/settings/{channel}", GetChannelConfig)
            .WithName("GetNotificationChannelConfig");

        app.MapPut("/api/notifications/settings/{channel}", SaveChannelConfig)
            .WithName("SaveNotificationChannelConfig");

        app.MapPost("/api/notifications/settings/{channel}/test", TestChannel)
            .WithName("TestNotificationChannel");

        app.MapDelete("/api/notifications/settings/{channel}", DeleteChannelConfig)
            .WithName("DeleteNotificationChannelConfig");

        app.MapGet("/api/notifications/log/{channel}", GetNotificationLog)
            .WithName("GetNotificationLog");

        app.MapGet("/api/notifications/settings/{channel}/pairing", GetPairing)
            .WithName("GetChannelPairing");

        app.MapPost("/api/notifications/settings/{channel}/pairing", StartPairing)
            .WithName("StartChannelPairing");

        app.MapDelete("/api/notifications/settings/{channel}/pairing", RevokePairing)
            .WithName("RevokeChannelPairing");

        app.MapGet("/api/notifications/settings/{channel}/listening", GetListening)
            .WithName("GetChannelListening");

        app.MapGet("/api/notifications/settings/{channel}/commands", GetCommandJournal)
            .WithName("GetChannelCommandJournal");

        return app;
    }

    private static async Task<IResult> ListChannels(ListNotificationChannelsUseCase useCase, CancellationToken ct)
        => Results.Ok(await useCase.ExecuteAsync(ct));

    private static async Task<IResult> GetChannelConfig(
        string channel,
        GetNotificationChannelConfigUseCase useCase,
        CancellationToken ct)
    {
        if (!TryParseChannel(channel, out var parsed)) return UnknownChannel(channel);

        var dto = await useCase.ExecuteAsync(parsed, ct);
        return dto is null ? UnknownChannel(channel) : Results.Ok(dto);
    }

    private static async Task<IResult> SaveChannelConfig(
        string channel,
        SaveNotificationChannelConfigRequest request,
        SaveNotificationChannelConfigUseCase useCase,
        CancellationToken ct)
    {
        if (!TryParseChannel(channel, out var parsed)) return UnknownChannel(channel);

        var dto = await useCase.ExecuteAsync(parsed, request, ct);
        return dto is null ? UnknownChannel(channel) : Results.Ok(dto);
    }

    private static async Task<IResult> TestChannel(
        string channel,
        TestNotificationChannelUseCase useCase,
        CancellationToken ct)
    {
        if (!TryParseChannel(channel, out var parsed)) return UnknownChannel(channel);

        return Results.Ok(await useCase.ExecuteAsync(parsed, ct));
    }

    private static async Task<IResult> DeleteChannelConfig(
        string channel,
        DeleteNotificationChannelConfigUseCase useCase,
        CancellationToken ct)
    {
        if (!TryParseChannel(channel, out var parsed)) return UnknownChannel(channel);

        return await useCase.ExecuteAsync(parsed, ct) ? Results.NoContent() : Results.NotFound();
    }

    private static IResult GetListening(string channel, GetChannelListeningUseCase useCase)
    {
        if (!TryParseChannel(channel, out var parsed)) return UnknownChannel(channel);

        var dto = useCase.Execute(parsed);
        return dto is null ? UnknownChannel(channel) : Results.Ok(dto);
    }

    private static async Task<IResult> GetCommandJournal(
        string channel,
        GetCommandJournalUseCase useCase,
        CancellationToken ct)
    {
        if (!TryParseChannel(channel, out var parsed)) return UnknownChannel(channel);

        return Results.Ok(await useCase.ExecuteAsync(parsed, ct: ct));
    }

    private static async Task<IResult> GetNotificationLog(
        string channel,
        GetNotificationLogUseCase useCase,
        CancellationToken ct)
    {
        if (!TryParseChannel(channel, out var parsed)) return UnknownChannel(channel);

        return Results.Ok(await useCase.ExecuteAsync(parsed, ct: ct));
    }

    private static async Task<IResult> GetPairing(
        string channel,
        GetChannelPairingUseCase useCase,
        CancellationToken ct)
    {
        if (!TryParseChannel(channel, out var parsed)) return UnknownChannel(channel);

        var dto = await useCase.ExecuteAsync(parsed, ct);
        return dto is null ? DoesNotListen(channel) : Results.Ok(dto);
    }

    private static async Task<IResult> StartPairing(
        string channel,
        StartChannelPairingUseCase useCase,
        CancellationToken ct)
    {
        if (!TryParseChannel(channel, out var parsed)) return UnknownChannel(channel);

        var dto = await useCase.ExecuteAsync(parsed, ct);
        return dto is null ? DoesNotListen(channel) : Results.Ok(dto);
    }

    private static async Task<IResult> RevokePairing(
        string channel,
        RevokeChannelPairingUseCase useCase,
        CancellationToken ct)
    {
        if (!TryParseChannel(channel, out var parsed)) return UnknownChannel(channel);

        return await useCase.ExecuteAsync(parsed, ct) ? Results.NoContent() : Results.NotFound();
    }

    private static bool TryParseChannel(string channel, out NotificationChannel parsed)
        => SnakeCaseEnum.TryFromSnakeCase(channel, out parsed);

    private static IResult UnknownChannel(string channel)
        => Results.Problem($"Canal de notification inconnu : {channel}.", statusCode: StatusCodes.Status400BadRequest);

    private static IResult DoesNotListen(string channel)
        => Results.Problem($"Ce canal n'accepte pas de commandes : {channel}.", statusCode: StatusCodes.Status400BadRequest);
}
