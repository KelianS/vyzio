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

/// <summary>
/// One direction of a channel and what it costs to open it. Sending and receiving are two surfaces,
/// with their own credentials — a channel may well carry only one of them (ADR-52).
/// </summary>
public sealed record ChannelTransport(IReadOnlyList<ChannelCredentialSpec> Credentials)
{
    public bool IsSatisfiedBy(ChannelCredentials credentials)
        => Credentials.All(spec => credentials.Has(spec.Field));
}

/// <summary>Everything the rest of the product needs to know about a channel without naming it.</summary>
public sealed record NotificationChannelDescriptor(
    NotificationChannel Channel,
    string DisplayName,
    ChannelCapabilities Capabilities,
    ChannelTransport Outbound,
    ChannelTransport? Inbound = null)
{
    /// <summary>A channel without an inbound transport is an alert channel and nothing else (ADR-52).</summary>
    public bool AcceptsCommands => Inbound is not null;

    /// <summary>Both directions asked together, since one screen collects them and a field may serve both.</summary>
    public IReadOnlyList<ChannelCredentialSpec> RequiredCredentials =>
        [.. Outbound.Credentials
            .Concat(Inbound?.Credentials ?? [])
            .DistinctBy(spec => spec.Field)];

    public bool IsSatisfiedBy(ChannelCredentials credentials)
        => RequiredCredentials.All(spec => credentials.Has(spec.Field));

    /// <summary>Whether a retrieval loop may start for this channel — nothing listens without that (ADR-52).</summary>
    public bool CanListen(ChannelCredentials credentials)
        => Inbound is not null && Inbound.IsSatisfiedBy(credentials);
}
