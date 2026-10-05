using System.Net;
using System.Net.Sockets;
using System.Text.Json.Nodes;
using System.Threading.Channels;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;
using Vyzio.Core.Common;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.CapabilityProviders;
using Vyzio.Infrastructure.VendorAdapters;
using Vyzio.Tests.Contracts;

namespace Vyzio.Tests.Services;

public class DvripPtzProviderTests
{
    private static readonly TimeSpan ShortMove = TimeSpan.FromMilliseconds(100);

    private static DvripPtzProvider MakeProvider(TimeProvider? time = null) =>
        new(new DvripClient(time ?? TimeProvider.System),
            new PtzMoveRunner(time ?? TimeProvider.System, NullLogger<PtzMoveRunner>.Instance),
            NullLogger<DvripPtzProvider>.Instance);

    [Fact]
    public void Protocol_ShouldBeDvrip_WhenTheProviderIsCreated()
    {
        Assert.Equal(SupportedProtocol.Dvrip, MakeProvider().Protocol);
    }

    [Fact]
    public async Task ProveAsync_ShouldFailTheCheck_WhenTheSessionDoesNotOpen()
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
        await Assert.ThrowsAnyAsync<CameraCommandException>(() => MakeProvider().ProveAsync(camera, binding, cts.Token));
    }

    [Fact]
    public async Task ProveAsync_ShouldLeavePtzToConfirm_WhenTheCameraAnswersDvripButRefusesSetPreset()
    {
        // Arrange
        var presets = new FakeDvripPresets(refusesSetPreset: true);
        await using var fake = FakeDvripCamera.Start(presets.Answer);
        fake.Binding.ConfigJson = NativePresetsConfig;

        // Act
        var proof = await MakeProvider().ProveAsync(fake.Camera, fake.Binding);

        // Assert
        Assert.Equal(ProofOutcome.Unprovable, proof.Outcome);
        Assert.False(BindingConfig.ReadBool(fake.Binding.ConfigJson, BindingConfig.SupportsNativePresets));
    }

    [Fact]
    public async Task ProveAsync_ShouldLeaveThePositionsToVyzio_WhenTheStoredPresetIsMissingFromTheList()
    {
        // Arrange
        var presets = new FakeDvripPresets(listsWhatItStores: false);
        await using var fake = FakeDvripCamera.Start(presets.Answer);

        // Act
        await MakeProvider().ProveAsync(fake.Camera, fake.Binding);

        // Assert
        Assert.False(BindingConfig.ReadBool(fake.Binding.ConfigJson, BindingConfig.SupportsNativePresets));
    }

    [Fact]
    public async Task ProveAsync_ShouldLeaveThePositionsToVyzio_WhenTheCameraRefusesToListItsPresets()
    {
        // Arrange
        await using var fake = FakeDvripCamera.Start(_ => """{"Ret":607}""");

        // Act
        await MakeProvider().ProveAsync(fake.Camera, fake.Binding);

        // Assert
        Assert.False(BindingConfig.ReadBool(fake.Binding.ConfigJson, BindingConfig.SupportsNativePresets));
    }

    [Fact]
    public async Task ProveAsync_ShouldStoreNothing_WhenTheAnswerCarriesNoPresetList()
    {
        // Arrange
        await using var fake = FakeDvripCamera.Start(_ => OkAnswer);

        // Act
        await MakeProvider().ProveAsync(fake.Camera, fake.Binding);

        // Assert
        Assert.False(BindingConfig.ReadBool(fake.Binding.ConfigJson, BindingConfig.SupportsNativePresets));
        Assert.Equal(1, fake.UnreadCommands);
    }

    [Fact]
    public async Task ProveAsync_ShouldRecordNativePresets_WhenAnIcseeReportsANullListBeforeStoringOne()
    {
        // Arrange
        var presets = new FakeDvripPresets(listsNullWhenEmpty: true);
        await using var fake = FakeDvripCamera.Start(presets.Answer);

        // Act
        await MakeProvider().ProveAsync(fake.Camera, fake.Binding);

        // Assert
        Assert.True(BindingConfig.ReadBool(fake.Binding.ConfigJson, BindingConfig.SupportsNativePresets));
        Assert.Equal<int?>(255, (await fake.ReceivedAsync(2))[1].Preset);
    }

    [Fact]
    public async Task ProveAsync_ShouldStoreThenClearTheHighestSlot_WhenNoPresetIsStoredYet()
    {
        // Arrange
        var presets = new FakeDvripPresets();
        await using var fake = FakeDvripCamera.Start(presets.Answer);

        // Act
        await MakeProvider().ProveAsync(fake.Camera, fake.Binding);

        // Assert
        var received = await fake.ReceivedAsync(4);
        Assert.Equal(["Uart.PTZPreset.[0]", "SetPreset", "Uart.PTZPreset.[0]", "ClearPreset"], received.Select(command => command.Name));
        Assert.Equal((255, 255), (received[1].Preset, received[3].Preset));
        Assert.Empty(presets.Stored);
    }

    [Fact]
    public async Task ProveAsync_ShouldClearTheProbeSlot_WhenTheCameraRefusesSetPreset()
    {
        // Arrange
        var presets = new FakeDvripPresets(refusesSetPreset: true);
        await using var fake = FakeDvripCamera.Start(presets.Answer);

        // Act
        await MakeProvider().ProveAsync(fake.Camera, fake.Binding);

        // Assert
        Assert.Equal(["Uart.PTZPreset.[0]", "SetPreset", "ClearPreset"], await fake.CommandsAsync(3));
    }

    [Fact]
    public async Task ProveAsync_ShouldClearTheProbeSlot_WhenTheStoredPresetIsMissingFromTheList()
    {
        // Arrange
        var presets = new FakeDvripPresets(listsWhatItStores: false);
        await using var fake = FakeDvripCamera.Start(presets.Answer);

        // Act
        await MakeProvider().ProveAsync(fake.Camera, fake.Binding);

        // Assert
        Assert.Equal(["Uart.PTZPreset.[0]", "SetPreset", "Uart.PTZPreset.[0]", "ClearPreset"], await fake.CommandsAsync(4));
    }

    [Fact]
    public async Task ProveAsync_ShouldKeepAPresetAlreadyStored_WhenItOccupiesTheHighestSlot()
    {
        // Arrange
        var presets = new FakeDvripPresets(stored: [3, 255]);
        await using var fake = FakeDvripCamera.Start(presets.Answer);

        // Act
        await MakeProvider().ProveAsync(fake.Camera, fake.Binding);

        // Assert
        Assert.Equal([3, 255], presets.Stored.Order());
        Assert.Equal<int?>(254, (await fake.ReceivedAsync(2))[1].Preset);
    }

    [Fact]
    public async Task PtzSavePresetAsync_ShouldStoreTheSlotInTheCamera_WhenTheCameraKeepsNativePresets()
    {
        // Arrange
        var presets = new FakeDvripPresets();
        await using var fake = FakeDvripCamera.Start(presets.Answer);

        // Act
        await MakeProvider().PtzSavePresetAsync(fake.Camera, fake.Binding, PtzPreset.ParkingSlot);

        // Assert
        Assert.Equal([PtzPreset.ParkingSlot], presets.Stored);
    }

    [Fact]
    public async Task PtzGoToPresetAsync_ShouldRecallTheSlotStoredInTheCamera_WhenTheCameraKeepsNativePresets()
    {
        // Arrange
        var presets = new FakeDvripPresets(stored: [PtzPreset.SurveillanceSlot]);
        await using var fake = FakeDvripCamera.Start(presets.Answer);

        // Act
        await MakeProvider().PtzGoToPresetAsync(fake.Camera, fake.Binding, PtzPreset.SurveillanceSlot);

        // Assert
        var recall = (await fake.ReceivedAsync(1))[0];
        Assert.Equal(("GotoPreset", (int?)PtzPreset.SurveillanceSlot), (recall.Name, recall.Preset));
    }

    [Fact]
    public async Task PtzSavePresetAsync_ShouldRaiseThatTheCameraRefused_WhenItRejectsSetPreset()
    {
        // Arrange
        var presets = new FakeDvripPresets(refusesSetPreset: true);
        await using var fake = FakeDvripCamera.Start(presets.Answer);

        // Act
        var error = await Assert.ThrowsAsync<CameraCommandRefusedException>(
            () => MakeProvider().PtzSavePresetAsync(fake.Camera, fake.Binding, PtzPreset.SurveillanceSlot));

        // Assert
        Assert.Contains("Ret=103", error.Message, StringComparison.Ordinal);
    }

    // Pairs of raw MD5 bytes, as python-dvr does; the hex-nibble variant is refused by the camera (ADR-29).
    [Fact]
    public void SofiaHash_ShouldMatchThePythonDvrReference_WhenGivenAKnownPassword()
    {
        Assert.Equal("mF95aD4o", DvripPtzProvider.SofiaHash("password"));
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
        await using var fake = FakeDvripCamera.Start(command: """{"Ret":103}""");
        await using var motion = await MakeProvider().OpenMotionAsync(fake.Camera, fake.Binding);

        // Act
        var error = await Assert.ThrowsAsync<CameraCommandRefusedException>(() => motion.MoveForAsync(PtzDirection.Left, 50, ShortMove));

        // Assert
        Assert.Contains("Ret=103", error.Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task MoveForAsync_ShouldStillSendTheStop_WhenTheCameraRejectsTheMove()
    {
        // Arrange
        await using var fake = FakeDvripCamera.Start(command: """{"Ret":103}""");
        await using var motion = await MakeProvider().OpenMotionAsync(fake.Camera, fake.Binding);

        // Act
        await Assert.ThrowsAsync<CameraCommandRefusedException>(() => motion.MoveForAsync(PtzDirection.Left, 50, ShortMove));

        // Assert
        Assert.Equal(["DirectionRight", "DirectionUp"], await fake.CommandsAsync(2));
    }

    [Fact]
    public async Task MoveForAsync_ShouldRaiseThatTheCameraRefused_WhenItsAnswerCarriesNoStatus()
    {
        // Arrange
        await using var fake = FakeDvripCamera.Start(command: """{"Name":"OPPTZControl"}""");
        await using var motion = await MakeProvider().OpenMotionAsync(fake.Camera, fake.Binding);

        // Act
        var error = await Assert.ThrowsAsync<CameraCommandRefusedException>(() => motion.MoveForAsync(PtzDirection.Left, 50, ShortMove));

        // Assert
        Assert.Contains("Ret=?", error.Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task OpenMotionAsync_ShouldRaiseThatTheCameraRefused_WhenItRejectsTheLogin()
    {
        // Arrange
        await using var fake = FakeDvripCamera.Start(command: null, refusesLogin: true);

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
        await using var fake = FakeDvripCamera.Start(command: null);
        await using var motion = await MakeProvider().OpenMotionAsync(fake.Camera, fake.Binding);

        // Act
        var error = await Assert.ThrowsAsync<CameraUnreachableException>(() => motion.MoveForAsync(PtzDirection.Left, 50, ShortMove));

        // Assert
        Assert.Contains(fake.Camera.Host, error.Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task MoveForAsync_ShouldCountTheMove_WhenTheCameraStaysSilentAfterReceivingIt()
    {
        // Arrange
        var time = new FakeTimeProvider();
        await using var fake = FakeDvripCamera.Start(command: OkAnswer, silentFirst: 1);
        await using var motion = await MakeProvider(time).OpenMotionAsync(fake.Camera, fake.Binding);
        var step = motion.MoveForAsync(PtzDirection.Left, 50, ShortMove);
        await fake.CommandsAsync(1);
        time.Advance(ShortMove);
        await fake.CommandsAsync(1);

        // Act
        time.Advance(TimeSpan.FromSeconds(5));

        // Assert
        Assert.Equal(ShortMove, await step);
    }

    [Fact]
    public async Task MoveForAsync_ShouldMoveThenStop_WhenTheCameraTakesBothCommands()
    {
        // Arrange
        var time = new FakeTimeProvider();
        await using var fake = FakeDvripCamera.Start(command: OkAnswer);
        await using var motion = await MakeProvider(time).OpenMotionAsync(fake.Camera, fake.Binding);
        var step = motion.MoveForAsync(PtzDirection.Left, 50, ShortMove);
        var move = await fake.CommandsAsync(1);

        // Act
        time.Advance(ShortMove);
        var stop = await fake.CommandsAsync(1);

        // Assert
        Assert.Equal(ShortMove, await step);
        Assert.Equal(["DirectionRight", "DirectionUp"], [.. move, .. stop]);
    }

    [Fact]
    public async Task MoveForAsync_ShouldStopTheDurationAfterTheMove_WhenTheCameraAnswersTheMoveAtOnce()
    {
        // Arrange
        var time = new FakeTimeProvider();
        await using var fake = FakeDvripCamera.Start(command: OkAnswer, clock: time);
        await using var motion = await MakeProvider(time).OpenMotionAsync(fake.Camera, fake.Binding);
        var step = motion.MoveForAsync(PtzDirection.Left, 50, ShortMove);
        var move = (await fake.ReceivedAsync(1))[0];

        // Act
        time.Advance(ShortMove);
        var stop = (await fake.ReceivedAsync(1))[0];

        // Assert
        Assert.Equal(ShortMove, stop.At - move.At);
        Assert.Equal(ShortMove, await step);
    }

    [Fact]
    public async Task MoveForAsync_ShouldStopTheDurationAfterTheMove_WhenTheCameraHasNotAnsweredTheMoveYet()
    {
        // Arrange
        var time = new FakeTimeProvider();
        await using var fake = FakeDvripCamera.Start(command: OkAnswer, holdAnswers: true, clock: time);
        await using var motion = await MakeProvider(time).OpenMotionAsync(fake.Camera, fake.Binding);
        var step = motion.MoveForAsync(PtzDirection.Left, 50, ShortMove);
        var move = (await fake.ReceivedAsync(1))[0];

        // Act
        time.Advance(ShortMove);
        var stop = (await fake.ReceivedAsync(1))[0];

        // Assert
        Assert.Equal(ShortMove, stop.At - move.At);
        fake.ReleaseAnswers();
        Assert.Equal(ShortMove, await step);
    }

    [Fact]
    public async Task MoveForAsync_ShouldMakeEveryMoveOnTheLoginOfTheSession_WhenSeveralMovesAreMade()
    {
        // Arrange
        var time = new FakeTimeProvider();
        await using var fake = FakeDvripCamera.Start(command: OkAnswer);
        var motion = await MakeProvider(time).OpenMotionAsync(fake.Camera, fake.Binding);

        // Act
        await MoveBrieflyAsync(motion, fake, time);
        await MoveBrieflyAsync(motion, fake, time);
        await MoveBrieflyAsync(motion, fake, time);
        await motion.DisposeAsync();

        // Assert
        Assert.Equal(1, fake.Logins);
    }

    [Fact]
    public async Task MoveForAsync_ShouldLogInAgainBeforeTheNextMove_WhenTheCameraDroppedTheSession()
    {
        // Arrange
        var time = new FakeTimeProvider();
        await using var fake = FakeDvripCamera.Start(command: OkAnswer, hangUpAt: 3);
        await using var motion = await MakeProvider(time).OpenMotionAsync(fake.Camera, fake.Binding);
        await MoveBrieflyAsync(motion, fake, time);
        await Assert.ThrowsAsync<CameraUnreachableException>(() => motion.MoveForAsync(PtzDirection.Left, 50, ShortMove));
        await fake.CommandsAsync(1);

        // Act
        await MoveBrieflyAsync(motion, fake, time);

        // Assert
        Assert.Equal(2, fake.Logins);
    }

    [Fact]
    public async Task StoppedAsync_ShouldReturnTheTimeFromTheMoveSentToTheStopSent_WhenTheCameraAnswersTheMoveLate()
    {
        // Arrange
        var time = new FakeTimeProvider();
        await using var fake = FakeDvripCamera.Start(command: OkAnswer, holdAnswers: true, clock: time);
        await using var motion = await MakeProvider(time).OpenMotionAsync(fake.Camera, fake.Binding);
        var released = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var start = motion.StartAsync(PtzDirection.Left, 50, released.Task);
        var move = await fake.CommandsAsync(1);
        time.Advance(TimeSpan.FromMilliseconds(700));
        fake.ReleaseAnswers();
        Assert.True(await start);
        time.Advance(TimeSpan.FromMilliseconds(1300));

        // Act
        released.SetResult();
        var moved = await motion.StoppedAsync();

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
        await using var fake = FakeDvripCamera.Start(command: """{"Ret":103}""");
        await using var motion = await MakeProvider().OpenMotionAsync(fake.Camera, fake.Binding);

        // Act
        var error = await Assert.ThrowsAsync<CameraCommandRefusedException>(() => motion.StartAsync(PtzDirection.Left, 50, new TaskCompletionSource().Task));

        // Assert
        Assert.Contains("Ret=103", error.Message, StringComparison.Ordinal);
        Assert.Equal(["DirectionRight", "DirectionUp"], await fake.CommandsAsync(2));
    }

    private const string OkAnswer = """{"Ret":100}""";
    private const string NativePresetsConfig = """{"supports_native_presets":true}""";

    // Moves, lets the short move run out on the fake clock, and waits for it to end.
    private static async Task MoveBrieflyAsync(IPtzMotion motion, FakeDvripCamera fake, FakeTimeProvider time)
    {
        var step = motion.MoveForAsync(PtzDirection.Left, 50, ShortMove);
        await fake.CommandsAsync(1);
        time.Advance(ShortMove);
        await fake.CommandsAsync(1);
        Assert.Equal(ShortMove, await step);
    }
}

// A DVRIP camera on a loopback port that logs in as the captured ICSee did (#92), then answers every command on the same connection as told.
internal sealed class FakeDvripCamera : IAsyncDisposable
{
    private readonly TcpListener _listener = new(IPAddress.Loopback, 0);
    private readonly CancellationTokenSource _stop = new();
    private readonly Channel<ReceivedCommand> _commands = Channel.CreateUnbounded<ReceivedCommand>();
    private readonly TaskCompletionSource _released = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private readonly TimeProvider _clock;
    private readonly Task _loop;
    private int _logins;

    private FakeDvripCamera(Behaviour behaviour, TimeProvider clock)
    {
        _listener.Start();
        _clock = clock;
        Camera = new Camera { Id = "cam", Slug = "cam", FrigateCameraName = "cam", DisplayName = "cam", Host = IPAddress.Loopback.ToString() };
        Camera.EnsureProtocol(SupportedProtocol.Dvrip).Port = ((IPEndPoint)_listener.LocalEndpoint).Port;
        if (!behaviour.HoldAnswers) _released.SetResult();
        _loop = ServeAsync(behaviour);
    }

    public Camera Camera { get; }

    public CameraCapabilityBinding Binding { get; } = new() { CameraId = "cam", Capability = CameraCapability.Ptz, Protocol = SupportedProtocol.Dvrip };

    public int Logins => Volatile.Read(ref _logins);

    public int UnreadCommands => _commands.Reader.Count;

    // A null command hangs up at the first command, hangUpAt at that command; the first silentFirst connections never answer a command; held answers wait for ReleaseAnswers.
    public static FakeDvripCamera Start(string? command, int silentFirst = 0, int hangUpAt = 0, bool holdAnswers = false, TimeProvider? clock = null, bool refusesLogin = false)
        => new(new Behaviour(CapturedLogin(refusesLogin), command, silentFirst, command is null ? 1 : hangUpAt, holdAnswers, Answer: null), clock ?? TimeProvider.System);

    // Answers each command as the handler says, from the request it received.
    public static FakeDvripCamera Start(Func<JsonNode, string> answer)
        => new(new Behaviour(CapturedLogin(refuses: false), Command: string.Empty, SilentFirst: 0, HangUpAt: 0, HoldAnswers: false, answer), TimeProvider.System);

    // The login answer body, without the terminator SendPacketAsync appends again.
    private static string CapturedLogin(bool refuses)
        => FixtureLoader.Variant(FixtureProtocol.Dvrip, CapturedVariant.Icsee)
            .Transcript(refuses ? DvripScenario.LoginRefused : DvripScenario.Login)
            .Messages.Single(message => message.Direction == TranscriptDirection.Received)
            .Body!.TrimEnd('\0', '\n');

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
                var request = JsonNode.Parse(sent)!;
                await _commands.Writer.WriteAsync(Received(request, _clock.GetUtcNow()), _stop.Token);
                if (n == behaviour.HangUpAt) break;
                if (!silent) await answers.Writer.WriteAsync(behaviour.Answer?.Invoke(request) ?? behaviour.Command!, _stop.Token);
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

    private static ReceivedCommand Received(JsonNode request, DateTimeOffset at)
        => request["OPPTZControl"] is { } ptz
            ? new(ptz["Command"]!.GetValue<string>(), at, ptz["Parameter"]!["Preset"]!.GetValue<int>())
            : new(request["Name"]!.GetValue<string>(), at);

    private sealed record Behaviour(string Login, string? Command, int SilentFirst, int HangUpAt, bool HoldAnswers, Func<JsonNode, string>? Answer);
}

// A PTZ command by its command name and preset, any other request by its name.
internal sealed record ReceivedCommand(string Name, DateTimeOffset At, int? Preset = null);

// Presets kept as an ICSee keeps them (docs/hardware/icsee.md): SetPreset lists the slot in Uart.PTZPreset, ClearPreset removes it; an empty list may read null.
internal sealed class FakeDvripPresets(bool refusesSetPreset = false, bool listsWhatItStores = true, bool listsNullWhenEmpty = false, params int[] stored)
{
    private const string Ok = """{"Ret":100}""";
    private const string Refused = """{"Ret":103}""";
    private readonly HashSet<int> _stored = [.. stored];
    private readonly Lock _gate = new();

    public IReadOnlyCollection<int> Stored
    {
        get { lock (_gate) return [.. _stored]; }
    }

    public string Answer(JsonNode request)
    {
        lock (_gate)
            return request["OPPTZControl"] is { } ptz ? Execute(ptz) : List();
    }

    private string Execute(JsonNode ptz)
    {
        var preset = ptz["Parameter"]!["Preset"]!.GetValue<int>();
        switch (ptz["Command"]!.GetValue<string>())
        {
            case "SetPreset" when refusesSetPreset:
                return Refused;
            case "SetPreset":
                if (listsWhatItStores) _stored.Add(preset);
                return Ok;
            case "ClearPreset":
                _stored.Remove(preset);
                return Ok;
            default:
                return Ok;
        }
    }

    private string List() => new JsonObject
    {
        ["Name"] = "Uart.PTZPreset.[0]",
        ["Ret"] = 100,
        ["Uart.PTZPreset.[0]"] = _stored.Count == 0 && listsNullWhenEmpty ? null : new JsonArray([.. _stored.Order().Select(id => (JsonNode)new JsonObject { ["Id"] = id })]),
    }.ToJsonString();
}
