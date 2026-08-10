using System.Text.Json;
using Vyzio.Core.Common;
using Vyzio.Core.Entities;

namespace Vyzio.Application.DTOs.Notifications;

/// <summary>One credential the channel asks for, and whether it is already stored.</summary>
public sealed record ChannelCredentialDto(string Field, bool Secret, bool IsSet, string? Value)
{
    public static ChannelCredentialDto From(ChannelCredentialSpec spec, ChannelCredentials credentials)
    {
        var stored = credentials[spec.Field];
        return new ChannelCredentialDto(
            Field: SnakeCaseEnum.ToSnakeCase(spec.Field),
            Secret: spec.Secret,
            IsSet: stored is not null,
            // A secret is never handed back — the screen only needs to know it exists.
            Value: spec.Secret ? null : stored);
    }
}

public sealed record ChannelCapabilitiesDto(bool Photo, bool Video, bool GroupedMedia, bool Buttons, int UsefulTextLength)
{
    public static ChannelCapabilitiesDto From(ChannelCapabilities capabilities)
        => new(capabilities.Photo, capabilities.Video, capabilities.GroupedMedia,
               capabilities.Buttons, capabilities.UsefulTextLength);
}

/// <summary>A channel as the list screen sees it: what it is, and where it stands.</summary>
public sealed record NotificationChannelSummaryDto(
    string Channel,
    string DisplayName,
    bool IsConfigured,
    bool IsEnabled);

public sealed record NotificationChannelConfigDto(
    string Channel,
    string DisplayName,
    bool IsEnabled,
    bool IsConfigured,
    ChannelCredentialDto[] Credentials,
    ChannelCapabilitiesDto Capabilities,
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
    private static readonly string[] DefaultLabels = ["person_unknown", "person_known"];

    /// <summary>A channel with no configuration yet still has a shape to show — that is the add screen.</summary>
    public static NotificationChannelConfigDto Unconfigured(NotificationChannelDescriptor descriptor)
        => From(descriptor, new NotificationChannelConfig { Channel = descriptor.Channel });

    public static NotificationChannelConfigDto From(
        NotificationChannelDescriptor descriptor,
        NotificationChannelConfig config)
    {
        var credentials = config.Credentials;

        return new NotificationChannelConfigDto(
            Channel: SnakeCaseEnum.ToSnakeCase(config.Channel),
            DisplayName: descriptor.DisplayName,
            IsEnabled: config.IsEnabled,
            IsConfigured: descriptor.IsSatisfiedBy(credentials),
            Credentials: [.. descriptor.RequiredCredentials.Select(spec => ChannelCredentialDto.From(spec, credentials))],
            Capabilities: ChannelCapabilitiesDto.From(descriptor.Capabilities),
            MinimumConfidence: config.MinimumConfidence,
            AllowedLabels: ParseLabels(config.AllowedLabelsJson),
            ActiveFromHour: config.ActiveFromHour,
            ActiveToHour: config.ActiveToHour,
            MessageFields: [.. UseCases.Notifications.MessageFields.Parse(config.MessageFieldsJson)
                .Select(SnakeCaseEnum.ToSnakeCase)],
            MediaMode: SnakeCaseEnum.ToSnakeCase(config.MediaMode),
            CooldownMinutes: config.CooldownMinutes,
            ConfiguredAt: config.ConfiguredAt,
            LastTestedAt: config.LastTestedAt,
            LastTestStatus: config.LastTestOutcome is { } outcome ? SnakeCaseEnum.ToSnakeCase(outcome) : null,
            LastTestError: config.LastTestError);
    }

    private static string[] ParseLabels(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return DefaultLabels;
        try
        {
            return JsonSerializer.Deserialize<string[]>(json) is { Length: > 0 } labels ? labels : DefaultLabels;
        }
        catch (JsonException)
        {
            return DefaultLabels;
        }
    }
}

/// <param name="Credentials">Channel field (snake_case) to value; a field left out keeps its stored value.</param>
public sealed record SaveNotificationChannelConfigRequest(
    bool IsEnabled,
    Dictionary<string, string?>? Credentials = null,
    float? MinimumConfidence = null,
    string[]? AllowedLabels = null,
    int? ActiveFromHour = null,
    int? ActiveToHour = null,
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
        => new(SnakeCaseEnum.ToSnakeCase(n.Status), n.SentAt, n.ErrorMessage);
}

public sealed record TestNotificationChannelResult(
    bool Success,
    string? ErrorMessage);
