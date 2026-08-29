using System.Text.Json;
using System.Threading.Channels;
using Microsoft.Extensions.Logging;

namespace Vyzio.Infrastructure.Notifications;

/// <summary>
/// The Discord gateway, reduced to what a command loop needs: Vyzio dials out and stays connected, so
/// the house needs no public address (ADR-50), and asks for no intent — only what is addressed to the
/// bot arrives (ADR-52).
/// </summary>
internal sealed class DiscordGateway(IDiscordGatewaySocketFactory sockets, ILogger logger)
{
    private const string GatewayUrl = "wss://gateway.discord.gg/?v=10&encoding=json";

    private const int Dispatch = 0;
    private const int Heartbeat = 1;
    private const int Identify = 2;
    private const int Reconnect = 7;
    private const int InvalidSession = 9;
    private const int Hello = 10;

    private static readonly TimeSpan ReconnectDelay = TimeSpan.FromSeconds(5);

    // An interaction Vyzio never read is an interaction it can no longer answer; the room is not a queue.
    private readonly Channel<JsonElement> _interactions = Channel.CreateBounded<JsonElement>(
        new BoundedChannelOptions(64) { FullMode = BoundedChannelFullMode.DropOldest });

    public ChannelReader<JsonElement> Interactions => _interactions.Reader;

    public async Task RunAsync(string botToken, CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try
            {
                await ConnectAsync(botToken, ct);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                logger.LogWarning(exception, "The Discord gateway connection dropped.");
            }

            try
            {
                await Task.Delay(ReconnectDelay, ct);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }

    private async Task ConnectAsync(string botToken, CancellationToken ct)
    {
        using var socket = sockets.Create();
        using var session = CancellationTokenSource.CreateLinkedTokenSource(ct);

        await socket.ConnectAsync(new Uri(GatewayUrl), ct);

        long? sequence = null;
        Task? heartbeat = null;

        try
        {
            while (await socket.ReceiveAsync(session.Token) is { } frame)
            {
                using var document = JsonDocument.Parse(frame);
                var payload = document.RootElement;

                if (payload.TryGetProperty("s", out var s) && s.ValueKind == JsonValueKind.Number)
                    sequence = s.GetInt64();

                switch (payload.GetProperty("op").GetInt32())
                {
                    case Hello:
                        await socket.SendAsync(IdentifyPayload(botToken), session.Token);
                        heartbeat = BeatAsync(
                            socket,
                            TimeSpan.FromMilliseconds(payload.GetProperty("d").GetProperty("heartbeat_interval").GetDouble()),
                            () => sequence,
                            session.Token);
                        break;

                    // Discord asks for a fresh connection; Vyzio keeps no session to resume.
                    case Reconnect:
                    case InvalidSession:
                        return;

                    case Dispatch when payload.TryGetProperty("t", out var name)
                                       && name.GetString() == "INTERACTION_CREATE":
                        _interactions.Writer.TryWrite(payload.GetProperty("d").Clone());
                        break;
                }
            }
        }
        finally
        {
            await session.CancelAsync();
            if (heartbeat is not null) await Task.WhenAny(heartbeat);
        }
    }

    /// <summary>Discord closes a connection that stops beating; the sequence tells it what was seen.</summary>
    private static async Task BeatAsync(
        IDiscordGatewaySocket socket,
        TimeSpan interval,
        Func<long?> sequence,
        CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            await Task.Delay(interval, ct);
            await socket.SendAsync(
                JsonSerializer.Serialize(new { op = Heartbeat, d = sequence() }),
                ct);
        }
    }

    private static string IdentifyPayload(string botToken) => JsonSerializer.Serialize(new
    {
        op = Identify,
        d = new
        {
            token = botToken,
            // No intent at all: Vyzio reads its own commands, never the conversation around them (ADR-52).
            intents = 0,
            properties = new { os = "linux", browser = "vyzio", device = "vyzio" }
        }
    });
}
