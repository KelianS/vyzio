using System.Text.Json;
using Vyzio.Application.DTOs.Notifications;
using Vyzio.Core.Common;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Notifications;

/// <summary>Every channel Vyzio knows how to talk through, configured or not — the list screen.</summary>
public sealed class ListNotificationChannelsUseCase(
    INotificationChannelCatalog catalog,
    INotificationChannelConfigRepository repository)
{
    public async Task<IReadOnlyList<NotificationChannelSummaryDto>> ExecuteAsync(CancellationToken ct = default)
    {
        var configs = (await repository.GetAllAsync(ct)).ToDictionary(config => config.Channel);

        return
        [
            .. catalog.Descriptors.Select(descriptor =>
            {
                configs.TryGetValue(descriptor.Channel, out var config);
                var credentials = config?.Credentials ?? ChannelCredentials.Empty;

                return new NotificationChannelSummaryDto(
                    Channel: SnakeCaseEnum.ToSnakeCase(descriptor.Channel),
                    DisplayName: descriptor.DisplayName,
                    IsConfigured: descriptor.IsSatisfiedBy(credentials),
                    IsEnabled: config?.IsEnabled ?? false,
                    AcceptsCommands: descriptor.AcceptsCommands);
            })
        ];
    }
}

public sealed class GetNotificationChannelConfigUseCase(
    INotificationChannelCatalog catalog,
    INotificationChannelConfigRepository repository)
{
    public async Task<NotificationChannelConfigDto?> ExecuteAsync(NotificationChannel channel, CancellationToken ct = default)
    {
        var descriptor = catalog.Describe(channel);
        if (descriptor is null) return null;

        var config = await repository.GetByChannelAsync(channel, ct);
        return config is null
            ? NotificationChannelConfigDto.Unconfigured(descriptor)
            : NotificationChannelConfigDto.From(descriptor, config);
    }
}

public sealed class SaveNotificationChannelConfigUseCase(
    INotificationChannelCatalog catalog,
    INotificationChannelConfigRepository repository)
{
    public async Task<NotificationChannelConfigDto?> ExecuteAsync(
        NotificationChannel channel,
        SaveNotificationChannelConfigRequest request,
        CancellationToken ct = default)
    {
        var descriptor = catalog.Describe(channel);
        if (descriptor is null) return null;

        var config = await repository.GetByChannelAsync(channel, ct)
                     ?? new NotificationChannelConfig { Channel = channel };

        config.IsEnabled = request.IsEnabled;
        config.MinimumConfidence = request.MinimumConfidence is >= 0f and <= 1f
            ? request.MinimumConfidence.Value
            : config.MinimumConfidence;

        if (request.AllowedLabels is { Length: > 0 })
            config.AllowedLabelsJson = JsonSerializer.Serialize(request.AllowedLabels);

        // null clears the restriction; a value in 0-23 sets it
        config.ActiveFromHour = request.ActiveFromHour is >= 0 and <= 23 ? request.ActiveFromHour : null;
        config.ActiveToHour = request.ActiveToHour is >= 0 and <= 23 ? request.ActiveToHour : null;

        if (request.MessageFields is { Length: > 0 })
            config.MessageFieldsJson = MessageFields.Serialize(ParseFields(request.MessageFields));
        else if (request.MessageFields is { Length: 0 })
            config.MessageFieldsJson = null; // empty array → reset to all fields

        if (SnakeCaseEnum.TryFromSnakeCase<MediaMode>(request.MediaMode, out var mediaMode))
            config.MediaMode = mediaMode;
        else if (request.MediaMode is not null)
            config.MediaMode = MediaMode.ClipOrPhoto; // unknown value → reset to default

        if (request.ClearCooldown)
            config.CooldownMinutes = null;
        else if (request.CooldownMinutes is > 0)
            config.CooldownMinutes = request.CooldownMinutes;

        var updates = ParseCredentials(descriptor, request.Credentials);
        if (updates.Count > 0)
        {
            config.Credentials = config.Credentials.With(updates);
            config.ConfiguredAt = DateTimeOffset.UtcNow;
        }

        await repository.UpsertAsync(config, ct);
        return NotificationChannelConfigDto.From(descriptor, config);
    }

    /// <summary>Keeps only the fields this channel declares, so a stray key can never land in storage.</summary>
    private static Dictionary<ChannelCredential, string?> ParseCredentials(
        NotificationChannelDescriptor descriptor,
        Dictionary<string, string?>? submitted)
    {
        var updates = new Dictionary<ChannelCredential, string?>();
        if (submitted is null) return updates;

        foreach (var spec in descriptor.RequiredCredentials)
        {
            var key = SnakeCaseEnum.ToSnakeCase(spec.Field);
            if (submitted.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value))
                updates[spec.Field] = value;
        }

        return updates;
    }

    private static List<MessageField> ParseFields(IEnumerable<string> submitted)
        => [.. submitted
            .Select(value => SnakeCaseEnum.TryFromSnakeCase<MessageField>(value, out var field) ? (MessageField?)field : null)
            .OfType<MessageField>()];
}

public sealed class DeleteNotificationChannelConfigUseCase(INotificationChannelConfigRepository repository)
{
    public async Task<bool> ExecuteAsync(NotificationChannel channel, CancellationToken ct = default)
        => await repository.DeleteByChannelAsync(channel, ct);
}

public sealed class GetNotificationLogUseCase(INotificationRepository notifications)
{
    public async Task<IReadOnlyList<NotificationLogEntryDto>> ExecuteAsync(
        NotificationChannel channel,
        int limit = 20,
        CancellationToken ct = default)
    {
        var entries = await notifications.GetRecentAsync(channel, limit, ct);
        return entries.Select(NotificationLogEntryDto.From).ToList();
    }
}

public sealed class TestNotificationChannelUseCase(
    INotificationChannelCatalog catalog,
    INotificationChannelConfigRepository repository)
{
    public async Task<TestNotificationChannelResult> ExecuteAsync(NotificationChannel channel, CancellationToken ct = default)
    {
        var sender = catalog.SenderFor(channel);
        var config = await repository.GetByChannelAsync(channel, ct);
        if (sender is null || config is null || !sender.Descriptor.IsSatisfiedBy(config.Credentials))
            return new TestNotificationChannelResult(false, "Canal non configure.");

        try
        {
            await sender.SendAsync(
                new OutgoingNotification(ChannelMessage.Plain(
                    "Test Vyzio — votre canal de notification est operationnel.")),
                config.Credentials,
                ct);

            return await RecordAsync(config, ChannelTestOutcome.Success, null, ct);
        }
        catch (Exception ex)
        {
            await RecordAsync(config, ChannelTestOutcome.Failure, ex.Message, ct);
            return new TestNotificationChannelResult(false, ex.Message);
        }
    }

    private async Task<TestNotificationChannelResult> RecordAsync(
        NotificationChannelConfig config, ChannelTestOutcome outcome, string? error, CancellationToken ct)
    {
        config.LastTestedAt = DateTimeOffset.UtcNow;
        config.LastTestOutcome = outcome;
        config.LastTestError = error;
        await repository.UpsertAsync(config, ct);
        return new TestNotificationChannelResult(outcome == ChannelTestOutcome.Success, error);
    }
}
