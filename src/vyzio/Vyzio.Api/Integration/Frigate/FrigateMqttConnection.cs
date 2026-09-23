namespace Vyzio.Api.Integration.Frigate;

public enum FrigateMqttState
{
    Starting,
    Subscribed,
    Lost,
}

// Where the ingress stands right now, kept by the ingress itself so health never opens a connection of its own.
public sealed class FrigateMqttConnection
{
    private volatile FrigateMqttState _state = FrigateMqttState.Starting;

    public FrigateMqttState State => _state;

    public void Subscribed() => _state = FrigateMqttState.Subscribed;

    public void Lost() => _state = FrigateMqttState.Lost;
}
