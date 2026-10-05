using System.Buffers.Binary;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Text.Json.Nodes;
using Vyzio.Core.Entities;
using Vyzio.Tests.Contracts;

namespace Vyzio.Tests.Services;

// A camera on a loopback port answering each raw TCP request with what a real one answered to it (#92): DVRIP, V380 or RTSP.
internal sealed class CapturedTcpCamera : IAsyncDisposable
{
    private readonly TcpListener _listener = new(IPAddress.Loopback, 0);
    private readonly CancellationTokenSource _stop = new();
    private readonly Wire _wire;
    private readonly string _variant;
    private readonly Dictionary<string, IReadOnlyList<TranscriptMessage>[]> _answers;
    private readonly Dictionary<string, int> _asked = [];
    private readonly List<string> _unanswered = [];
    private readonly Task _loop;

    private CapturedTcpCamera(FixtureProtocol protocol, string variant, IEnumerable<string> scenarios)
    {
        _wire = WireOf(protocol);
        _variant = variant;
        var captured = FixtureLoader.Variant(protocol, variant);
        _answers = scenarios
            .SelectMany(scenario => Exchanges(variant, scenario, captured.Transcript(scenario).Messages))
            .GroupBy(exchange => _wire.KeyOf(exchange.Sent))
            .ToDictionary(group => group.Key, group => group.Select(exchange => exchange.Answer).ToArray());
        _listener.Start();
        Port = ((IPEndPoint)_listener.LocalEndpoint).Port;
        _loop = ServeAsync();
    }

    // Captured answers in scenario order, the last repeated: a client logs in again on every connection.
    public static CapturedTcpCamera Replaying(FixtureProtocol protocol, string variant, params string[] scenarios)
        => new(protocol, variant, scenarios);

    public int Port { get; }

    // The captured requests no client sent yet: empty once the client walked the whole exchange.
    public IReadOnlyList<string> Unasked
    {
        get { lock (_asked) return [.. _answers.Keys.Where(key => !_asked.ContainsKey(key))]; }
    }

    // A camera on this peer, reached on its protocol line (ADR-61), with the fixture account and the given password.
    public Camera Camera(string password)
    {
        var camera = new Camera
        {
            Id = "cam1",
            Slug = "cam1",
            FrigateCameraName = "cam1",
            DisplayName = "cam1",
            Host = IPAddress.Loopback.ToString(),
            Username = FixtureLoader.Neutral.Account.Username,
            Password = password,
        };
        camera.EnsureProtocol(_wire.Protocol).Port = Port;
        return camera;
    }

    // A request nobody captured fails the test here, named, rather than as a client error far from its cause.
    public async ValueTask DisposeAsync()
    {
        await _stop.CancelAsync();
        _listener.Stop();
        await _loop;
        _stop.Dispose();
        if (_unanswered.Count > 0)
            throw new InvalidOperationException($"{_variant} has no captured answer to: {string.Join(" | ", _unanswered)}");
    }

    private static IEnumerable<(TranscriptMessage Sent, IReadOnlyList<TranscriptMessage> Answer)> Exchanges(string variant, string scenario, IReadOnlyList<TranscriptMessage> messages)
    {
        TranscriptMessage? sent = null;
        var answer = new List<TranscriptMessage>();
        foreach (var message in messages)
        {
            switch (message.Direction)
            {
                case TranscriptDirection.Sent:
                    if (sent is not null) yield return (sent, answer);
                    (sent, answer) = (message, []);
                    break;
                case TranscriptDirection.Received when message.Event is not null:
                    throw new InvalidDataException($"{variant}/{scenario}: the camera went {message.Event}, which a hand-written fake reproduces, not this replay.");
                case TranscriptDirection.Received when sent is not null:
                    answer.Add(message);
                    break;
                default:
                    throw new InvalidDataException($"{variant}/{scenario}: not a TCP exchange opened by the client, the replay cannot serve it.");
            }
        }
        if (sent is not null) yield return (sent, answer);
    }

    private async Task ServeAsync()
    {
        var connections = new List<Task>();
        try
        {
            while (true)
                connections.Add(AnswerAsync(await _listener.AcceptTcpClientAsync(_stop.Token)));
        }
        catch (OperationCanceledException) when (_stop.IsCancellationRequested)
        {
        }
        await Task.WhenAll(connections);
    }

    // A connection that sends nothing is a reachability dial, not a request.
    private async Task AnswerAsync(TcpClient client)
    {
        using var connection = client;
        try
        {
            var stream = connection.GetStream();
            while (await _wire.ReadRequestAsync(stream, _stop.Token) is { } request)
            {
                var key = _wire.KeyOf(request, Port);
                if (NextAnswer(key) is not { } answer)
                {
                    lock (_unanswered) _unanswered.Add(key);
                    return;
                }
                foreach (var message in answer)
                    await stream.WriteAsync(_wire.BytesOf(message), _stop.Token);
            }
        }
        catch (Exception ex) when (ex is OperationCanceledException or IOException or SocketException)
        {
        }
    }

    private IReadOnlyList<TranscriptMessage>? NextAnswer(string key)
    {
        if (!_answers.TryGetValue(key, out var answers)) return null;
        lock (_asked)
        {
            var asked = _asked.GetValueOrDefault(key);
            _asked[key] = asked + 1;
            return answers[Math.Min(asked, answers.Length - 1)];
        }
    }

    private static Wire WireOf(FixtureProtocol protocol) => protocol switch
    {
        FixtureProtocol.Dvrip => new DvripWire(),
        FixtureProtocol.V380 => new V380Wire(),
        FixtureProtocol.Rtsp => new RtspWire(),
        _ => throw new ArgumentOutOfRangeException(nameof(protocol), protocol, "not replayed over raw TCP"),
    };

    // Reads the bytes until count arrived; null when the client hung up first.
    private static async Task<byte[]?> ReadExactlyOrNullAsync(NetworkStream stream, int count, CancellationToken ct)
    {
        var buffer = new byte[count];
        return await stream.ReadAtLeastAsync(buffer, count, throwOnEndOfStream: false, ct) == count ? buffer : null;
    }

    // How one protocol frames a request, and what of it must match the capture.
    private abstract class Wire
    {
        public abstract SupportedProtocol Protocol { get; }

        public abstract Task<byte[]?> ReadRequestAsync(NetworkStream stream, CancellationToken ct);

        public abstract string KeyOf(byte[] request, int port);

        public abstract string KeyOf(TranscriptMessage sent);

        public abstract byte[] BytesOf(TranscriptMessage received);
    }

    // A 20-byte header then a JSON body; the sequence number is the client's own count, the command and body are the contract.
    private sealed class DvripWire : Wire
    {
        private const int HeaderSize = 20;
        private const int CommandOffset = 14;
        private const int LengthOffset = 16;

        public override SupportedProtocol Protocol => SupportedProtocol.Dvrip;

        public override async Task<byte[]?> ReadRequestAsync(NetworkStream stream, CancellationToken ct)
        {
            if (await ReadExactlyOrNullAsync(stream, HeaderSize, ct) is not { } header) return null;
            var body = await ReadExactlyOrNullAsync(stream, BinaryPrimitives.ReadInt32LittleEndian(header.AsSpan(LengthOffset)), ct);
            return body is null ? null : [.. header, .. body];
        }

        public override string KeyOf(byte[] request, int port)
            => Key(request.AsSpan(0, HeaderSize), Encoding.UTF8.GetString(request, HeaderSize, request.Length - HeaderSize));

        public override string KeyOf(TranscriptMessage sent)
            => Key(Convert.FromHexString(sent.Header!), sent.Body!);

        // The captured length counted the private values the neutral ones replaced.
        public override byte[] BytesOf(TranscriptMessage received)
        {
            var header = Convert.FromHexString(received.Header!);
            var body = Encoding.UTF8.GetBytes(received.Body!);
            BinaryPrimitives.WriteInt32LittleEndian(header.AsSpan(LengthOffset), body.Length);
            return [.. header, .. body];
        }

        private static string Key(ReadOnlySpan<byte> header, string body)
            => $"{BinaryPrimitives.ReadUInt16LittleEndian(header[CommandOffset..])} {JsonNode.Parse(body.TrimEnd('\0', '\n'))!.ToJsonString()}";
    }

    // Fixed 256-byte frames; an auth frame matches on the password it carries, not on its random session key.
    private sealed class V380Wire : Wire
    {
        private const int FrameSize = 256;

        public override SupportedProtocol Protocol => SupportedProtocol.V380;

        public override Task<byte[]?> ReadRequestAsync(NetworkStream stream, CancellationToken ct)
            => ReadExactlyOrNullAsync(stream, FrameSize, ct);

        public override string KeyOf(byte[] request, int port) => Key(request);

        public override string KeyOf(TranscriptMessage sent) => Key(Convert.FromHexString(sent.Hex!));

        public override byte[] BytesOf(TranscriptMessage received) => Convert.FromHexString(received.Hex!);

        private static string Key(byte[] frame)
        {
            if (!V380AuthFrame.CarriesAPassword(frame)) return Convert.ToHexStringLower(frame);
            var password = V380AuthFrame.Password(frame);
            var fixedPart = frame.ToArray();
            fixedPart.AsSpan(V380AuthFrame.Secret).Clear();
            return $"{Convert.ToHexStringLower(fixedPart)} password={password}";
        }
    }

    // A request ends at its blank line; the loopback address stands where the captured camera was.
    private sealed class RtspWire : Wire
    {
        private static readonly string CapturedAuthority = $"{FixtureLoader.Neutral.CameraHost}:{ProtocolPorts.Usual(SupportedProtocol.Rtsp)}";

        private static readonly string[] FixturePasswords = [FixtureLoader.Neutral.Account.Password, FixtureLoader.Neutral.RefusedPassword];

        public override SupportedProtocol Protocol => SupportedProtocol.Rtsp;

        public override async Task<byte[]?> ReadRequestAsync(NetworkStream stream, CancellationToken ct)
        {
            var request = new List<byte>();
            var buffer = new byte[1024];
            while (!Encoding.ASCII.GetString([.. request]).EndsWith("\r\n\r\n", StringComparison.Ordinal))
            {
                var read = await stream.ReadAsync(buffer, ct);
                if (read == 0) return null;
                request.AddRange(buffer.AsSpan(0, read));
            }
            return [.. request];
        }

        // The Digest response hashes the address dialled: one that hashes a fixture password is hashed again for the captured address.
        public override string KeyOf(byte[] request, int port)
        {
            var sent = Encoding.ASCII.GetString(request);
            var captured = sent.Replace($"{IPAddress.Loopback}:{port}", CapturedAuthority, StringComparison.Ordinal);
            if (FixtureHygiene.RtspDigest().Match(sent) is not { Success: true } digest) return captured;
            var method = sent[..sent.IndexOf(' ', StringComparison.Ordinal)];
            if (FixturePasswords.FirstOrDefault(password => FixtureHygiene.RtspDigestResponse(method, digest, password) == digest.Groups["response"].Value) is not { } hashed)
                return captured;
            var recaptured = FixtureHygiene.RtspDigest().Match(captured);
            return captured.Replace(recaptured.Groups["response"].Value, FixtureHygiene.RtspDigestResponse(method, recaptured, hashed), StringComparison.Ordinal);
        }

        public override string KeyOf(TranscriptMessage sent) => sent.Text!;

        public override byte[] BytesOf(TranscriptMessage received) => Encoding.ASCII.GetBytes(received.Text!);
    }
}
