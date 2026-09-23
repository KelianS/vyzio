namespace Vyzio.Api.Integration.Frigate;

// Whether the ingress is subscribed right now, kept by the ingress itself so health never opens a connection of its own.
public sealed class FrigateMqttConnection
{
    private volatile bool _subscribed;

    public bool IsSubscribed => _subscribed;

    public void Subscribed() => _subscribed = true;

    public void Lost() => _subscribed = false;
}
