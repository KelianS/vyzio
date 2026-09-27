using System.Net;
using System.Net.Sockets;
using System.Text.Json.Nodes;
using System.Threading.Channels;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.CapabilityProviders;
using Vyzio.Infrastructure.VendorAdapters;

namespace Vyzio.Tests.Services;

public class DvripPtzProviderTests
{
    private static readonly TimeSpan Tap = TimeSpan.FromMilliseconds(100);

    private static DvripPtzProvider MakeProvider(TimeProvider? time = null) =>
        new(new DvripClient(time ?? TimeProvider.System, NullLogger<DvripClient>.Instance),
            new PtzMoveRunner(time ?? TimeProvider.System, NullLogger<PtzMoveRunner>.Instance),
            NullLogger<DvripPtzProvider>.Instance);

    [Fact]
    public void Protocol_ShouldBeDvrip_WhenTheProviderIsCreated()
    {
        Assert.Equal(SupportedProtocol.Dvrip, MakeProvider().Protocol);
    }

    [Fact]
    public async Task ProbeAsync_ShouldReturnFalse_WhenTheCameraIsUnreachable()
    {
        var camera = new Camera
        {
            Slug = "cam",
            FrigateCameraName = "cam",
            DisplayName = "cam",
            Host = "127.0.0.1",
            Port = 554,
        };
        var binding = new CameraCapabilityBinding
        {
            CameraId = "cam",
            Capability = CameraCapability.Ptz,
            Protocol = SupportedProtocol.Dvrip,
        };

        // Port 1 is reserved and always connection-refused — guaranteed no DVRIP listener.
        camera.Host = "127.0.0.1";

        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(4));
        var result = await MakeProvider().ProbeAsync(camera, binding, cts.Token);

        Assert.False(result);
    }

    // SofiaHash — pairs of raw MD5 bytes (not hex nibbles), matching python-dvr's reference
    // implementation. Verified against a real ICSee camera (2026-07-15, Ret=100 on login);
    // the previous hex-nibble-pairing variant was rejected (Ret=203, "Password is incorrect").
    [Fact]
    public void SofiaHash_ShouldMatchTheValueVerifiedOnARealCamera_WhenGivenAKnownPassword()
    {
        Assert.Equal("S8jyn9CB", DvripPtzProvider.SofiaHash("a4m3h5"));
    }

    [Fact]
    public void SofiaHash_ShouldReturnEightCharacters_WhenGivenAPassword()
    {
        Assert.Equal(8, DvripPtzProvider.SofiaHash("any_password").Length);
    }

    [Fact]
    public void SofiaHash_ShouldReturnEightCharacters_WhenThePasswordIsEmpty()
    {
        Assert.Equal(8, DvripPtzProvider.SofiaHash(string.Empty).Length);
    }

    [Fact]
    public void SofiaHash_ShouldUseOnlyAlphanumericCharacters_WhenThePasswordHasSymbols()
    {
        const string allowed = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
        var result = DvripPtzProvider.SofiaHash("test_password_123!");
        Assert.All(result, c => Assert.Contains(c, allowed));
    }

    // Left/Right (and diagonals) intentionally swapped vs. the DVRIP command name that would
    // seem intuitive — confirmed against real hardware (2026-07-15) that this camera's
    // horizontal axis is mirrored relative to Vyzio's Left/Right, while vertical was correct.
    [Theory]
    [InlineData(PtzDirection.Up, "DirectionUp")]
    [InlineData(PtzDirection.Down, "DirectionDown")]
    [InlineData(PtzDirection.Left, "DirectionRight")]
    [InlineData(PtzDirection.Right, "DirectionLeft")]
    [InlineData(PtzDirection.UpLeft, "DirectionRightUp")]
    [InlineData(PtzDirection.UpRight, "DirectionLeftUp")]
    [InlineData(PtzDirection.DownLeft, "DirectionRightDown")]
    [InlineData(PtzDirection.DownRight, "DirectionLeftDown")]
    public void DirectionToCommand_ShouldMirrorTheHorizontalAxis_WhenMappingEachDirection(PtzDirection direction, string expected)
    {
        Assert.Equal(expected, DvripPtzProvider.DirectionToCommand(direction));
    }

    // Confirmed against real hardware (2026-07-15, via dbuezas/icsee-ptz): Preset=-1 is the
    // real stop sentinel, Preset=0 is a normal move. Sending Preset=-1 for a move (not just
    // stop) silently makes the camera ignore the command entirely — this is the single most
    // regression-prone detail in this file, hence a dedicated test.
    [Fact]
    public void BuildPtzPayload_ShouldUsePresetZero_WhenBuildingAMove()
    {
        var json = DvripPtzProvider.BuildPtzPayload("0x00000001", "DirectionRight", preset: 0, step: 5);
        var preset = JsonNode.Parse(json)?["OPPTZControl"]?["Parameter"]?["Preset"]?.GetValue<int>();
        Assert.Equal(0, preset);
    }

    [Fact]
    public void BuildPtzPayload_ShouldUsePresetMinusOne_WhenBuildingAStop()
    {
        var json = DvripPtzProvider.BuildPtzPayload("0x00000001", "DirectionUp", preset: -1, step: 5);
        var preset = JsonNode.Parse(json)?["OPPTZControl"]?["Parameter"]?["Preset"]?.GetValue<int>();
        Assert.Equal(-1, preset);
    }

    [Fact]
    public void BuildPtzPayload_ShouldOmitActionAndPointAndStartThePattern_WhenBuildingACommand()
    {
        var json = DvripPtzProvider.BuildPtzPayload("0x00000001", "DirectionUp", preset: -1, step: 5);
        var node = JsonNode.Parse(json)!;

        Assert.Null(node["OPPTZControl"]!["Action"]);
        Assert.Null(node["OPPTZControl"]!["Parameter"]!["POINT"]);
        Assert.Equal("Start", node["OPPTZControl"]!["Parameter"]!["Pattern"]!.GetValue<string>());
    }

    [Fact]
    public async Task OpenMotionAsync_ShouldRaiseThatTheCameraIsUnreachable_WhenNoDvripServiceAnswers()
    {
        // Arrange
        var camera = new Camera { Id = "cam", Slug = "cam", FrigateCameraName = "cam", DisplayName = "cam", Host = "127.0.0.1" };
        var binding = new CameraCapabilityBinding { CameraId = "cam", Capability = CameraCapability.Ptz, Protocol = SupportedProtocol.Dvrip };

        // Act
        var error = await Assert.ThrowsAsync<CameraUnreachableException>(
            () => MakeProvider().OpenMotionAsync(camera, binding));

        // Assert
        Assert.Contains("127.0.0.1", error.Message, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData("""{"Ret":100}""", 100)]
    [InlineData("""{"Ret":103,"SessionID":"0x1"}""", 103)]
    public void ReadRet_ShouldReturnTheStatus_WhenTheAnswerCarriesOne(string answer, int expected)
    {
        // Arrange

        // Act
        var ret = DvripClient.ReadRet(answer);

        // Assert
        Assert.Equal(expected, ret);
    }

    [Theory]
    [InlineData("""{"Name":"OPPTZControl"}""")]
    [InlineData("not json")]
    [InlineData(null)]
    public void ReadRet_ShouldReturnNull_WhenTheAnswerCarriesNoReadableStatus(string? answer)
    {
        // Arrange

        // Act
        var ret = DvripClient.ReadRet(answer);

        // Assert
        Assert.Null(ret);
    }

    [Fact]
    public async Task MoveForAsync_ShouldRaiseThatTheCameraRefused_WhenItRejectsTheMove()
    {
        // Arrange
        await using var fake = FakeDvripCamera.Start(login: LoginOk, command: """{"Ret":103}""");
        await using var motion = await MakeProvider().OpenMotionAsync(fake.Camera, fake.Binding);

        // Act
        var error = await Assert.ThrowsAsync<CameraCommandRefusedException>(() => motion.MoveForAsync(PtzDirection.Left, 50, Tap));

        // Assert
        Assert.Contains("Ret=103", error.Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task MoveForAsync_ShouldStillSendTheStop_WhenTheCameraRejectsTheMove()
    {
        // Arrange
        await using var fake = FakeDvripCamera.Start(login: LoginOk, command: """{"Ret":103}""");
        await using var motion = await MakeProvider().OpenMotionAsync(fake.Camera, fake.Binding);

        // Act
        await Assert.ThrowsAsync<CameraCommandRefusedException>(() => motion.MoveForAsync(PtzDirection.Left, 50, Tap));

        // Assert
        Assert.Equal(["DirectionRight", "DirectionUp"], await fake.CommandsAsync(2));
    }

    [Fact]
    public async Task MoveForAsync_ShouldRaiseThatTheCameraRefused_WhenItsAnswerCarriesNoStatus()
    {
        // Arrange
        await using var fake = FakeDvripCamera.Start(login: LoginOk, command: """{"Name":"OPPTZControl"}""");
        await using var motion = await MakeProvider().OpenMotionAsync(fake.Camera, fake.Binding);

        // Act
        var error = await Assert.ThrowsAsync<CameraCommandRefusedException>(() => motion.MoveForAsync(PtzDirection.Left, 50, Tap));

        // Assert
        Assert.Contains("Ret=?", error.Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task OpenMotionAsync_ShouldRaiseThatTheCameraRefused_WhenItRejectsTheLogin()
    {
        // Arrange
        await using var fake = FakeDvripCamera.Start(login: """{"Ret":203}""", command: null);

        // Act
        var error = await Assert.ThrowsAsync<CameraCommandRefusedException>(
            () => MakeProvider().OpenMotionAsync(fake.Camera, fake.Binding));

        // Assert
        Assert.Contains("Ret=203", error.Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task MoveForAsync_ShouldRaiseThatTheCameraIsUnreachable_WhenItHangsUpInsteadOfAnswering()
    {
        // Arrange
        await using var fake = FakeDvripCamera.Start(login: LoginOk, command: null);
        await using var motion = await MakeProvider().OpenMotionAsync(fake.Camera, fake.Binding);

        // Act
        var error = await Assert.ThrowsAsync<CameraUnreachableException>(() => motion.MoveForAsync(PtzDirection.Left, 50, Tap));

        // Assert
        Assert.Contains("connection closed", error.Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task MoveForAsync_ShouldCountTheMove_WhenTheCameraStaysSilentAfterReceivingIt()
    {
        // Arrange
        var time = new FakeTimeProvider();
        await using var fake = FakeDvripCamera.Start(login: LoginOk, command: OkAnswer, silentFirst: 1);
        await using var motion = await MakeProvider(time).OpenMotionAsync(fake.Camera, fake.Binding);
        var step = motion.MoveForAsync(PtzDirection.Left, 50, Tap);
        await fake.CommandsAsync(1);
        time.Advance(Tap);
        await fake.CommandsAsync(1);

        // Act
        time.Advance(TimeSpan.FromSeconds(5));

        // Assert
        Assert.Equal(Tap, await step);
    }

    [Fact]
    public async Task MoveForAsync_ShouldMoveThenStop_WhenTheCameraTakesBothCommands()
    {
        // Arrange
        var time = new FakeTimeProvider();
        await using var fake = FakeDvripCamera.Start(login: LoginOk, command: OkAnswer);
        await using var motion = await MakeProvider(time).OpenMotionAsync(fake.Camera, fake.Binding);
        var step = motion.MoveForAsync(PtzDirection.Left, 50, Tap);
        var move = await fake.CommandsAsync(1);

        // Act
        time.Advance(Tap);
        var stop = await fake.CommandsAsync(1);

        // Assert
        Assert.Equal(Tap, await step);
        Assert.Equal(["DirectionRight", "DirectionUp"], [.. move, .. stop]);
    }

    [Fact]
    public async Task MoveForAsync_ShouldStopTheDurationAfterTheMove_WhenTheCameraAnswersTheMoveAtOnce()
    {
        // Arrange
        var time = new FakeTimeProvider();
        await using var fake = FakeDvripCamera.Start(login: LoginOk, command: OkAnswer, clock: time);
        await using var motion = await MakeProvider(time).OpenMotionAsync(fake.Camera, fake.Binding);
        var step = motion.MoveForAsync(PtzDirection.Left, 50, Tap);
        var move = (await fake.ReceivedAsync(1))[0];

        // Act
        time.Advance(Tap);
        var stop = (await fake.ReceivedAsync(1))[0];

        // Assert
        Assert.Equal(Tap, stop.At - move.At);
        Assert.Equal(Tap, await step);
    }

    [Fact]
    public async Task MoveForAsync_ShouldStopTheDurationAfterTheMove_WhenTheCameraHasNotAnsweredTheMoveYet()
    {
        // Arrange
        var time = new FakeTimeProvider();
        await using var fake = FakeDvripCamera.Start(login: LoginOk, command: OkAnswer, holdAnswers: true, clock: time);
        await using var motion = await MakeProvider(time).OpenMotionAsync(fake.Camera, fake.Binding);
        var step = motion.MoveForAsync(PtzDirection.Left, 50, Tap);
        var move = (await fake.ReceivedAsync(1))[0];

        // Act
        time.Advance(Tap);
        var stop = (await fake.ReceivedAsync(1))[0];

        // Assert
        Assert.Equal(Tap, stop.At - move.At);
        fake.ReleaseAnswers();
        Assert.Equal(Tap, await step);
    }

    [Fact]
    public async Task MoveForAsync_ShouldMakeEveryMoveOnTheLoginOfTheSession_WhenSeveralMovesAreMade()
    {
        // Arrange
        var time = new FakeTimeProvider();
        await using var fake = FakeDvripCamera.Start(login: LoginOk, command: OkAnswer);
        var motion = await MakeProvider(time).OpenMotionAsync(fake.Camera, fake.Binding);

        // Act
        await TapAsync(motion, fake, time);
        await TapAsync(motion, fake, time);
        await TapAsync(motion, fake, time);
        await motion.DisposeAsync();

        // Assert
        Assert.Equal(1, fake.Logins);
    }

    [Fact]
    public async Task MoveForAsync_ShouldLogInAgainBeforeTheNextMove_WhenTheCameraDroppedTheSession()
    {
        // Arrange
        var time = new FakeTimeProvider();
        await using var fake = FakeDvripCamera.Start(login: LoginOk, command: OkAnswer, hangUpAt: 3);
        await using var motion = await MakeProvider(time).OpenMotionAsync(fake.Camera, fake.Binding);
        await TapAsync(motion, fake, time);
        await Assert.ThrowsAsync<CameraUnreachableException>(() => motion.MoveForAsync(PtzDirection.Left, 50, Tap));
        await fake.CommandsAsync(1);

        // Act
        await TapAsync(motion, fake, time);

        // Assert
        Assert.Equal(2, fake.Logins);
    }

    [Fact]
    public async Task StopAsync_ShouldReturnTheTimeFromTheMoveSentToTheStopSent_WhenTheCameraAnswersTheMoveLate()
    {
        // Arrange
        var time = new FakeTimeProvider();
        await using var fake = FakeDvripCamera.Start(login: LoginOk, command: OkAnswer, holdAnswers: true, clock: time);
        await using var motion = await MakeProvider(time).OpenMotionAsync(fake.Camera, fake.Binding);
        var start = motion.StartAsync(PtzDirection.Left, 50);
        var move = await fake.CommandsAsync(1);
        time.Advance(TimeSpan.FromMilliseconds(700));
        fake.ReleaseAnswers();
        Assert.True(await start);
        time.Advance(TimeSpan.FromMilliseconds(1300));

        // Act
        var moved = await motion.StopAsync();

        // Assert
        var stop = await fake.CommandsAsync(1);
        Assert.Equal(TimeSpan.FromSeconds(2), moved);
        Assert.Equal(["DirectionRight", "DirectionUp"], [.. move, .. stop]);
        Assert.Equal(1, fake.Logins);
    }

    [Fact]
    public async Task StartAsync_ShouldRaiseThatTheCameraRefusedAndStopAtOnce_WhenItRejectsTheMove()
    {
        // Arrange
        await using var fake = FakeDvripCamera.Start(login: LoginOk, command: """{"Ret":103}""");
        await using var motion = await MakeProvider().OpenMotionAsync(fake.Camera, fake.Binding);

        // Act
        var error = await Assert.ThrowsAsync<CameraCommandRefusedException>(() => motion.StartAsync(PtzDirection.Left, 50));

        // Assert
        Assert.Contains("Ret=103", error.Message, StringComparison.Ordinal);
        Assert.Equal(["DirectionRight", "DirectionUp"], await fake.CommandsAsync(2));
    }

    private const string LoginOk = """{"Ret":100,"SessionID":"0x0000000B"}""";
    private const string OkAnswer = """{"Ret":100}""";

    // Moves, lets the tap run out on the fake clock, and waits for the tap to end.
    private static async Task TapAsync(IPtzMotion motion, FakeDvripCamera fake, FakeTimeProvider time)
    {
        var step = motion.MoveForAsync(PtzDirection.Left, 50, Tap);
        await fake.CommandsAsync(1);
        time.Advance(Tap);
        await fake.CommandsAsync(1);
        Assert.Equal(Tap, await step);
    }
}

// A DVRIP camera on its own loopback address (the port is fixed): answers every login, then every command on the same connection, as told.
internal sealed class FakeDvripCamera : IAsyncDisposable
{
    private readonly TcpListener _listener;
    private readonly CancellationTokenSource _stop = new();
    private readonly Channel<ReceivedCommand> _commands = Channel.CreateUnbounded<ReceivedCommand>();
    private readonly TaskCompletionSource _released = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private readonly TimeProvider _clock;
    private readonly Task _loop;
    private int _logins;

    private FakeDvripCamera(IPAddress address, Behaviour behaviour, TimeProvider clock)
    {
        _listener = new TcpListener(address, 34567);
        _listener.Start();
        _clock = clock;
        Camera = new Camera { Id = "cam", Slug = "cam", FrigateCameraName = "cam", DisplayName = "cam", Host = address.ToString() };
        if (!behaviour.HoldAnswers) _released.SetResult();
        _loop = ServeAsync(behaviour);
    }

    public Camera Camera { get; }

    public CameraCapabilityBinding Binding { get; } = new() { CameraId = "cam", Capability = CameraCapability.Ptz, Protocol = SupportedProtocol.Dvrip };

    public int Logins => Volatile.Read(ref _logins);

    // A null command hangs up at the first command, hangUpAt at that command; the first silentFirst connections never answer a command; held answers wait for ReleaseAnswers.
    public static FakeDvripCamera Start(string login, string? command, int silentFirst = 0, int hangUpAt = 0, bool holdAnswers = false, TimeProvider? clock = null)
        => new(new IPAddress([127, 0, (byte)Random.Shared.Next(1, 255), (byte)Random.Shared.Next(2, 255)]),
            new Behaviour(login, command, silentFirst, command is null ? 1 : hangUpAt, holdAnswers), clock ?? TimeProvider.System);

    public void ReleaseAnswers() => _released.TrySetResult();

    public async Task<string[]> CommandsAsync(int count)
        => [.. (await ReceivedAsync(count)).Select(command => command.Name)];

    public async Task<ReceivedCommand[]> ReceivedAsync(int count)
    {
        var received = new ReceivedCommand[count];
        for (var i = 0; i < count; i++)
            received[i] = await _commands.Reader.ReadAsync(_stop.Token);
        return received;
    }

    private async Task ServeAsync(Behaviour behaviour)
    {
        var handlers = new List<Task>();
        try
        {
            while (!_stop.IsCancellationRequested)
            {
                var client = await _listener.AcceptTcpClientAsync(_stop.Token);
                handlers.Add(AnswerAsync(client, behaviour, silent: handlers.Count < behaviour.SilentFirst));
            }
        }
        catch (OperationCanceledException) when (_stop.IsCancellationRequested)
        {
        }
        await Task.WhenAll(handlers);
    }

    private async Task AnswerAsync(TcpClient client, Behaviour behaviour, bool silent)
    {
        using var connection = client;
        var answers = Channel.CreateUnbounded<string>();
        var answering = Task.CompletedTask;
        try
        {
            var stream = connection.GetStream();
            await DvripClient.ReceivePacketAsync(stream, _stop.Token);
            Interlocked.Increment(ref _logins);
            await DvripClient.SendPacketAsync(stream, 1001, behaviour.Login, 0, "0x0000000B", _stop.Token);
            answering = SendAnswersAsync(stream, answers.Reader);
            for (var n = 1; await DvripClient.ReceivePacketAsync(stream, _stop.Token) is { } sent; n++)
            {
                await _commands.Writer.WriteAsync(new ReceivedCommand(JsonNode.Parse(sent)!["OPPTZControl"]!["Command"]!.GetValue<string>(), _clock.GetUtcNow()), _stop.Token);
                if (n == behaviour.HangUpAt) break;
                if (!silent) await answers.Writer.WriteAsync(behaviour.Command!, _stop.Token);
            }
        }
        catch (OperationCanceledException) when (_stop.IsCancellationRequested)
        {
        }
        catch (IOException)
        {
        }
        answers.Writer.TryComplete();
        connection.Close();
        await answering;
    }

    private async Task SendAnswersAsync(NetworkStream stream, ChannelReader<string> answers)
    {
        try
        {
            await foreach (var answer in answers.ReadAllAsync(_stop.Token))
            {
                await _released.Task.WaitAsync(_stop.Token);
                await DvripClient.SendPacketAsync(stream, 1401, answer, 3, "0x0000000B", _stop.Token);
            }
        }
        catch (Exception ex) when (ex is OperationCanceledException or IOException or ObjectDisposedException)
        {
        }
    }

    public async ValueTask DisposeAsync()
    {
        await _stop.CancelAsync();
        _listener.Stop();
        await _loop;
        _stop.Dispose();
    }

    private sealed record Behaviour(string Login, string? Command, int SilentFirst, int HangUpAt, bool HoldAnswers);
}

internal sealed record ReceivedCommand(string Name, DateTimeOffset At);
