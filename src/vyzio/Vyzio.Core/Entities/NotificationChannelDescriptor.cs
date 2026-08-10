namespace Vyzio.Core.Entities;

/// <summary>
/// What a channel is able to render. The product adapts to it instead of assuming it, exactly as the
/// camera capability catalogue does for hardware (ADR-50, ADR-22).
/// </summary>
/// <param name="GroupedMedia">The channel renders a photo and a video as one message rather than two.</param>
/// <param name="UsefulTextLength">Characters a caption carries before the channel truncates it.</param>
public sealed record ChannelCapabilities(
    bool Photo,
    bool Video,
    bool GroupedMedia,
    bool Buttons,
    int UsefulTextLength);

/// <param name="Secret">Once stored the value is never handed back — only the fact that it is set.</param>
public sealed record ChannelCredentialSpec(ChannelCredential Field, bool Secret);

/// <summary>Everything the rest of the product needs to know about a channel without naming it.</summary>
public sealed record NotificationChannelDescriptor(
    NotificationChannel Channel,
    string DisplayName,
    ChannelCapabilities Capabilities,
    IReadOnlyList<ChannelCredentialSpec> RequiredCredentials)
{
    public bool IsSatisfiedBy(ChannelCredentials credentials)
        => RequiredCredentials.All(spec => credentials.Has(spec.Field));
}
