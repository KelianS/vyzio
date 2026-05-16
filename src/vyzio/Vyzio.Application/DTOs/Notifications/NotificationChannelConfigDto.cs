using System.Text.Json;
using Vyzio.Core.Entities;

namespace Vyzio.Application.DTOs.Notifications;

public sealed record NotificationChannelConfigDto(
    string Channel,
    bool IsEnabled,
    bool HasToken,
    string? ChatId,
    float MinimumConfidence,
    string[] AllowedLabels,
    int? ActiveFromHour,
    int? ActiveToHour,
    string[] MessageFields,
    string MediaMode,
    int? CooldownMinutes,
    DateTimeOffset? ConfiguredAt,
    DateTimeOffset? LastTestedAt,
    string? LastTestStatus,
    string? LastTestError)
{
    private static readonly string[] DefaultLabels = ["person", "person_known"];
    private static readonly string[] DefaultFields = ["camera", "time", "label", "confidence", "snapshot"];

    public static NotificationChannelConfigDto From(NotificationChannelConfig config)
    {
        string[] labels;
        try
        {
            labels = !string.IsNullOrWhiteSpace(config.AllowedLabelsJson)
                ? JsonSerializer.Deserialize<string[]>(config.AllowedLabelsJson) ?? DefaultLabels
                : DefaultLabels;
        }
        catch
        {
            labels = DefaultLabels;
        }

        string[] fields;
        try
        {
            fields = !string.IsNullOrWhiteSpace(config.MessageFieldsJson)
                ? JsonSerializer.Deserialize<string[]>(config.MessageFieldsJson) ?? DefaultFields
                : DefaultFields;
        }
        catch
        {
            fields = DefaultFields;
        }

        return new NotificationChannelConfigDto(
            Channel: config.Channel,
            IsEnabled: config.IsEnabled,
            HasToken: !string.IsNullOrWhiteSpace(config.BotToken),
            ChatId: config.ChatId,
            MinimumConfidence: config.MinimumConfidence,
            AllowedLabels: labels,
            ActiveFromHour: config.ActiveFromHour,
            ActiveToHour: config.ActiveToHour,
            MessageFields: fields,
            MediaMode: config.MediaMode ?? "clip_or_photo",
            CooldownMinutes: config.CooldownMinutes,
            ConfiguredAt: config.ConfiguredAt,
            LastTestedAt: config.LastTestedAt,
            LastTestStatus: config.LastTestStatus,
            LastTestError: config.LastTestError);
    }
}

public sealed record SaveNotificationChannelConfigRequest(
    bool IsEnabled,
    string? BotToken,
    string? ChatId,
    float? MinimumConfidence,
    string[]? AllowedLabels,
    int? ActiveFromHour,
    int? ActiveToHour,
    string[]? MessageFields = null,
    string? MediaMode = null,
    int? CooldownMinutes = null,
    bool ClearCooldown = false);

public sealed record NotificationLogEntryDto(
    string Status,
    DateTimeOffset SentAt,
    string? ErrorMessage)
{
    public static NotificationLogEntryDto From(Notification n)
        => new(n.Status, n.SentAt, n.ErrorMessage);
}

public sealed record TestNotificationChannelResult(
    bool Success,
    string? ErrorMessage);
