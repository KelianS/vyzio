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
    DateTimeOffset? ConfiguredAt,
    DateTimeOffset? LastTestedAt,
    string? LastTestStatus,
    string? LastTestError)
{
    private static readonly string[] DefaultLabels = ["person"];

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

        return new NotificationChannelConfigDto(
            Channel: config.Channel,
            IsEnabled: config.IsEnabled,
            HasToken: !string.IsNullOrWhiteSpace(config.BotToken),
            ChatId: config.ChatId,
            MinimumConfidence: config.MinimumConfidence,
            AllowedLabels: labels,
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
    string[]? AllowedLabels);

public sealed record TestNotificationChannelResult(
    bool Success,
    string? ErrorMessage);
