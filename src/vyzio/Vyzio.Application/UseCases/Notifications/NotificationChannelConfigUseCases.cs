using System.Text.Json;
using Vyzio.Application.DTOs.Notifications;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Notifications;

public sealed class GetNotificationChannelConfigUseCase(INotificationChannelConfigRepository repository)
{
    public async Task<NotificationChannelConfigDto?> ExecuteAsync(string channel, CancellationToken ct = default)
    {
        var config = await repository.GetByChannelAsync(channel, ct);
        return config is null ? null : NotificationChannelConfigDto.From(config);
    }
}

public sealed class SaveNotificationChannelConfigUseCase(INotificationChannelConfigRepository repository)
{
    public async Task<NotificationChannelConfigDto> ExecuteAsync(
        string channel,
        SaveNotificationChannelConfigRequest request,
        CancellationToken ct = default)
    {
        var existing = await repository.GetByChannelAsync(channel, ct);

        var config = existing ?? new NotificationChannelConfig { Channel = channel };

        config.IsEnabled = request.IsEnabled;
        config.ChatId = request.ChatId?.Trim();
        config.MinimumConfidence = request.MinimumConfidence is >= 0f and <= 1f
            ? request.MinimumConfidence.Value
            : config.MinimumConfidence;

        if (request.AllowedLabels is { Length: > 0 })
            config.AllowedLabelsJson = JsonSerializer.Serialize(request.AllowedLabels);

        // null clears the restriction; a value in 0-23 sets it
        config.ActiveFromHour = request.ActiveFromHour is >= 0 and <= 23 ? request.ActiveFromHour : null;
        config.ActiveToHour = request.ActiveToHour is >= 0 and <= 23 ? request.ActiveToHour : null;

        if (request.MessageFields is { Length: > 0 })
            config.MessageFieldsJson = JsonSerializer.Serialize(request.MessageFields);
        else if (request.MessageFields is { Length: 0 })
            config.MessageFieldsJson = null; // empty array → reset to all fields

        // Only update token when a non-empty value is explicitly provided
        if (!string.IsNullOrWhiteSpace(request.BotToken))
        {
            config.BotToken = request.BotToken.Trim();
            config.ConfiguredAt = DateTimeOffset.UtcNow;
        }

        await repository.UpsertAsync(config, ct);
        return NotificationChannelConfigDto.From(config);
    }
}

public sealed class DeleteNotificationChannelConfigUseCase(INotificationChannelConfigRepository repository)
{
    public async Task<bool> ExecuteAsync(string channel, CancellationToken ct = default)
        => await repository.DeleteByChannelAsync(channel, ct);
}

public sealed class GetNotificationLogUseCase(INotificationRepository notifications)
{
    public async Task<IReadOnlyList<NotificationLogEntryDto>> ExecuteAsync(
        string channel,
        int limit = 20,
        CancellationToken ct = default)
    {
        var entries = await notifications.GetRecentAsync(channel, limit, ct);
        return entries.Select(NotificationLogEntryDto.From).ToList();
    }
}

public sealed class TestNotificationChannelUseCase(
    INotificationChannelConfigRepository repository,
    ITelegramNotificationSender telegramSender)
{
    public async Task<TestNotificationChannelResult> ExecuteAsync(string channel, CancellationToken ct = default)
    {
        var config = await repository.GetByChannelAsync(channel, ct);
        if (config is null || !config.HasCredentials)
            return new TestNotificationChannelResult(false, "Canal non configure.");

        try
        {
            await telegramSender.SendAsync(
                "Test Vyzio — votre canal de notification est operationnel.",
                config.BotToken!,
                config.ChatId!,
                ct);

            config.LastTestedAt = DateTimeOffset.UtcNow;
            config.LastTestStatus = "success";
            config.LastTestError = null;
            await repository.UpsertAsync(config, ct);
            return new TestNotificationChannelResult(true, null);
        }
        catch (Exception ex)
        {
            config.LastTestedAt = DateTimeOffset.UtcNow;
            config.LastTestStatus = "failure";
            config.LastTestError = ex.Message;
            await repository.UpsertAsync(config, ct);
            return new TestNotificationChannelResult(false, ex.Message);
        }
    }
}
