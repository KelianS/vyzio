using System.Net;
using System.Net.Sockets;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.CapabilityProviders;
using Vyzio.Infrastructure.VendorAdapters;

namespace Vyzio.Tests.Services;

public class DvripPtzProviderTests
{
    private static DvripPtzProvider MakeProvider(TimeProvider? time = null) =>
        new(new DvripClient(time ?? TimeProvider.System, NullLogger<DvripClient>.Instance), NullLogger<DvripPtzProvider>.Instance);

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
    public async Task PtzStepAsync_ShouldRaiseThatTheCameraIsUnreachable_WhenNoDvripServiceAnswers()
    {
        // Arrange
        var camera = new Camera { Id = "cam", Slug = "cam", FrigateCameraName = "cam", DisplayName = "cam", Host = "127.0.0.1" };
        var binding = new CameraCapabilityBinding { CameraId = "cam", Capability = CameraCapability.Ptz, Protocol = SupportedProtocol.Dvrip };

        // Act
        var error = await Assert.ThrowsAsync<CameraUnreachableException>(
            () => MakeProvider().PtzStepAsync(camera, binding, PtzDirection.Left, 50));

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
    public async Task PtzStepAsync_ShouldRaiseThatTheCameraRefused_WhenItRejectsTheMove()
    {
        // Arrange
        await using var fake = FakeDvripCamera.Start(login: """{"Ret":100,"SessionID":"0x0000000B"}""", command: """{"Ret":103}""");

        // Act
        var error = await Assert.ThrowsAsync<CameraCommandRefusedException>(
            () => MakeProvider().PtzStepAsync(fake.Camera, fake.Binding, PtzDirection.Left, 50));

        // Assert
        Assert.Contains("Ret=103", error.Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task PtzStepAsync_ShouldStillSendTheStop_WhenTheCameraRejectsTheMove()
    {
        // Arrange
        await using var fake = FakeDvripCamera.Start(login: """{"Ret":100,"SessionID":"0x0000000B"}""", command: """{"Ret":103}""");

        // Act
        await Assert.ThrowsAsync<CameraCommandRefusedException>(
            () => MakeProvider().PtzStepAsync(fake.Camera, fake.Binding, PtzDirection.Left, 50));

        // Assert
        Assert.Equal(["DirectionRight", "DirectionUp"], await fake.CommandsAsync(2));
    }

    [Fact]
    public async Task PtzStepAsync_ShouldRaiseThatTheCameraRefused_WhenItsAnswerCarriesNoStatus()
    {
        // Arrange
        await using var fake = FakeDvripCamera.Start(login: """{"Ret":100,"SessionID":"0x0000000B"}""", command: """{"Name":"OPPTZControl"}""");

        // Act
        var error = await Assert.ThrowsAsync<CameraCommandRefusedException>(
            () => MakeProvider().PtzStepAsync(fake.Camera, fake.Binding, PtzDirection.Left, 50));

        // Assert
        Assert.Contains("Ret=?", error.Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task PtzStepAsync_ShouldRaiseThatTheCameraRefused_WhenItRejectsTheLogin()
    {
        // Arrange
        await using var fake = FakeDvripCamera.Start(login: """{"Ret":203}""", command: null);

        // Act
        var error = await Assert.ThrowsAsync<CameraCommandRefusedException>(
            () => MakeProvider().PtzStepAsync(fake.Camera, fake.Binding, PtzDirection.Left, 50));

        // Assert
        Assert.Contains("Ret=203", error.Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task PtzStepAsync_ShouldRaiseThatTheCameraIsUnreachable_WhenItHangsUpInsteadOfAnswering()
    {
        // Arrange
        await using var fake = FakeDvripCamera.Start(login: """{"Ret":100,"SessionID":"0x0000000B"}""", command: null);

        // Act
        var error = await Assert.ThrowsAsync<CameraUnreachableException>(
            () => MakeProvider().PtzStepAsync(fake.Camera, fake.Binding, PtzDirection.Left, 50));

        // Assert
        Assert.Contains("connection closed", error.Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task PtzStepAsync_ShouldTakeTheStep_WhenTheCameraStaysSilentAfterReceivingTheMove()
    {
        // Arrange
        var time = new FakeTimeProvider();
        await using var fake = FakeDvripCamera.Start(login: """{"Ret":100,"SessionID":"0x0000000B"}""", command: """{"Ret":100}""", silentFirst: 1);
        var step = MakeProvider(time).PtzStepAsync(fake.Camera, fake.Binding, PtzDirection.Left, 50);
        await fake.CommandsAsync(1);

        // Act
        time.Advance(TimeSpan.FromSeconds(5));

        // Assert
        Assert.True(await step);
        Assert.Equal(["DirectionUp"], await fake.CommandsAsync(1));
    }

    [Fact]
    public async Task PtzStepAsync_ShouldMoveThenStop_WhenTheCameraTakesBothCommands()
    {
        // Arrange
        await using var fake = FakeDvripCamera.Start(login: """{"Ret":100,"SessionID":"0x0000000B"}""", command: """{"Ret":100}""");

        // Act
        var taken = await MakeProvider().PtzStepAsync(fake.Camera, fake.Binding, PtzDirection.Left, 50);

        // Assert
        Assert.True(taken);
        Assert.Equal(["DirectionRight", "DirectionUp"], await fake.CommandsAsync(2));
    }
}

// A DVRIP camera on its own loopback address (the port is fixed): answers every login, then every command, as told.
internal sealed class FakeDvripCamera : IAsyncDisposable
{
    private readonly TcpListener _listener;
    private readonly CancellationTokenSource _stop = new();
    private readonly System.Threading.Channels.Channel<string> _commands = System.Threading.Channels.Channel.CreateUnbounded<string>();
    private readonly Task _loop;

    private FakeDvripCamera(IPAddress address, string login, string? command, int silentFirst)
    {
        _listener = new TcpListener(address, 34567);
        _listener.Start();
        Camera = new Camera { Id = "cam", Slug = "cam", FrigateCameraName = "cam", DisplayName = "cam", Host = address.ToString() };
        _loop = ServeAsync(login, command, silentFirst);
    }

    public Camera Camera { get; }

    public CameraCapabilityBinding Binding { get; } = new() { CameraId = "cam", Capability = CameraCapability.Ptz, Protocol = SupportedProtocol.Dvrip };

    // A null command hangs up once it has the command; the first silentFirst connections keep the line open in silence.
    public static FakeDvripCamera Start(string login, string? command, int silentFirst = 0)
        => new(new IPAddress([127, 0, (byte)Random.Shared.Next(1, 255), (byte)Random.Shared.Next(2, 255)]), login, command, silentFirst);

    public async Task<string[]> CommandsAsync(int count)
    {
        var received = new string[count];
        for (var i = 0; i < count; i++)
            received[i] = await _commands.Reader.ReadAsync(_stop.Token);
        return received;
    }

    private async Task ServeAsync(string login, string? command, int silentFirst)
    {
        var handlers = new List<Task>();
        try
        {
            while (!_stop.IsCancellationRequested)
            {
                var client = await _listener.AcceptTcpClientAsync(_stop.Token);
                handlers.Add(AnswerAsync(client, login, command, silent: handlers.Count < silentFirst));
            }
        }
        catch (OperationCanceledException) when (_stop.IsCancellationRequested)
        {
        }
        await Task.WhenAll(handlers);
    }

    private async Task AnswerAsync(TcpClient client, string login, string? command, bool silent)
    {
        using var connection = client;
        try
        {
            var stream = connection.GetStream();
            await DvripClient.ReceivePacketAsync(stream, _stop.Token);
            await DvripClient.SendPacketAsync(stream, 1001, login, 0, "0x0000000B", _stop.Token);
            var sent = await DvripClient.ReceivePacketAsync(stream, _stop.Token);
            if (sent is not null)
                await _commands.Writer.WriteAsync(JsonNode.Parse(sent)!["OPPTZControl"]!["Command"]!.GetValue<string>(), _stop.Token);
            if (silent)
                await Task.Delay(Timeout.Infinite, _stop.Token);
            else if (command is not null)
                await DvripClient.SendPacketAsync(stream, 1401, command, 3, "0x0000000B", _stop.Token);
        }
        catch (OperationCanceledException) when (_stop.IsCancellationRequested)
        {
        }
        catch (IOException)
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
}
