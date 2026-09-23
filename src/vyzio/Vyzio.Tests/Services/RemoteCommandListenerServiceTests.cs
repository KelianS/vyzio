using System.Globalization;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;
using NSubstitute;
using Vyzio.Application.Services;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.Notifications;
using Vyzio.Tests.Services.Hosting;

namespace Vyzio.Tests.Services;

public class RemoteCommandListenerServiceTests
{
    private static readonly TimeSpan Step = TimeSpan.FromSeconds(5);

    private readonly IChannelCommandReceiver _telegram = Substitute.For<IChannelCommandReceiver>();
    private readonly IChannelCommandReceiverCatalog _receivers = Substitute.For<IChannelCommandReceiverCatalog>();
    private readonly INotificationChannelConfigRepository _configs = Substitute.For<INotificationChannelConfigRepository>();
    private readonly IRemoteCommandRegistry _registry = Substitute.For<IRemoteCommandRegistry>();
    private readonly IChannelListenerHealth _health = Substitute.For<IChannelListenerHealth>();
    private readonly FakeTimeProvider _time = BackgroundLoop.ClockAt("2026-09-23T10:00:00+00:00");

    public RemoteCommandListenerServiceTests()
    {
        _telegram.Channel.Returns(NotificationChannel.Telegram);
        _receivers.ReceiverFor(NotificationChannel.Telegram).Returns(_telegram);
        _registry.Descriptors.Returns([]);
    }

    private RemoteCommandListenerService CreateSut(ILogger<RemoteCommandListenerService>? logger = null) => new(
        _receivers,
        BackgroundLoop.Scopes(services => services
            .AddSingleton(ListeningCatalog())
            .AddSingleton(_configs)
            .AddSingleton(_registry)),
        _health,
        _time,
        logger ?? NullLogger<RemoteCommandListenerService>.Instance);

    private static INotificationChannelCatalog ListeningCatalog()
    {
        var sender = Substitute.For<INotificationChannelSender>();
        var botToken = new ChannelTransport([new ChannelCredentialSpec(ChannelCredential.BotToken, Secret: true)]);
        sender.Descriptor.Returns(new NotificationChannelDescriptor(
            NotificationChannel.Telegram,
            "Telegram",
            new ChannelCapabilities(true, true, true, true, 1024),
            botToken,
            botToken));
        return new NotificationChannelCatalog([sender]);
    }

    private static NotificationChannelConfig Telegram(bool enabled) => new()
    {
        Channel = NotificationChannel.Telegram,
        IsEnabled = enabled,
        Credentials = new ChannelCredentials([new(ChannelCredential.BotToken, "123:abc")]),
        ConfiguredAt = DateTimeOffset.Parse("2026-09-01T00:00:00+00:00", CultureInfo.InvariantCulture),
    };

    // A real channel long-polls; the fake answers once per call it is told to, then holds the round open.
    private TaskCompletionSource SignalOnReceive(int call)
    {
        var received = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var calls = 0;
        _telegram.ReceiveAsync(Arg.Any<IReadOnlyList<RemoteCommandDescriptor>>(), Arg.Any<ChannelCredentials>(), Arg.Any<CancellationToken>())
            .Returns(async info =>
            {
                if (++calls == call) received.TrySetResult();
                await Task.Delay(Timeout.Infinite, info.ArgAt<CancellationToken>(2));
                return (IReadOnlyList<IncomingMessage>)[];
            });
        return received;
    }

    [Fact]
    public async Task ExecuteAsync_ShouldListen_WhenAChannelIsEnabledWithItsBotToken()
    {
        // Arrange
        _configs.GetAllAsync(Arg.Any<CancellationToken>()).Returns([Telegram(enabled: true)]);
        var listening = SignalOnReceive(call: 1);
        var sut = CreateSut();

        // Act
        await sut.StartAsync(CancellationToken.None);
        await listening.Task.ObservedAsync();
        await sut.StopAsync(CancellationToken.None);

        // Assert
        _health.Received().Started(NotificationChannel.Telegram);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldListenAgain_WhenARoundFailsThenTheChannelComesBack()
    {
        // Arrange
        _configs.GetAllAsync(Arg.Any<CancellationToken>()).Returns([Telegram(enabled: true)]);
        var back = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var calls = 0;
        _telegram.ReceiveAsync(Arg.Any<IReadOnlyList<RemoteCommandDescriptor>>(), Arg.Any<ChannelCredentials>(), Arg.Any<CancellationToken>())
            .Returns(async info =>
            {
                if (++calls == 1) throw new HttpRequestException("api.telegram.org unreachable");
                back.TrySetResult();
                await Task.Delay(Timeout.Infinite, info.ArgAt<CancellationToken>(2));
                return (IReadOnlyList<IncomingMessage>)[];
            });
        var sut = CreateSut();

        // Act
        await sut.StartAsync(CancellationToken.None);
        await _time.AdvanceUntilAsync(back.Task, Step);
        await sut.StopAsync(CancellationToken.None);

        // Assert
        _health.Received(1).Interrupted(NotificationChannel.Telegram, "api.telegram.org unreachable");
    }

    [Fact]
    public async Task ExecuteAsync_ShouldStartListening_WhenTheConfigurationBecomesReadableAgain()
    {
        // Arrange
        _configs.GetAllAsync(Arg.Any<CancellationToken>())
            .Returns(
                _ => throw new InvalidOperationException("database is locked"),
                _ => Task.FromResult<IReadOnlyList<NotificationChannelConfig>>([Telegram(enabled: true)]));
        var listening = SignalOnReceive(call: 1);
        var sut = CreateSut();

        // Act
        await sut.StartAsync(CancellationToken.None);
        await _time.AdvanceUntilAsync(listening.Task, Step);
        await sut.StopAsync(CancellationToken.None);

        // Assert
        await _configs.Received(2).GetAllAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldStopListening_WhenTheChannelIsDisabled()
    {
        // Arrange
        _configs.GetAllAsync(Arg.Any<CancellationToken>())
            .Returns(
                _ => Task.FromResult<IReadOnlyList<NotificationChannelConfig>>([Telegram(enabled: true)]),
                _ => Task.FromResult<IReadOnlyList<NotificationChannelConfig>>([Telegram(enabled: false)]));
        var stopped = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        _health.When(h => h.Stopped(NotificationChannel.Telegram)).Do(_ => stopped.TrySetResult());
        SignalOnReceive(call: 1);
        var sut = CreateSut();

        // Act
        await sut.StartAsync(CancellationToken.None);
        await _time.AdvanceUntilAsync(stopped.Task, Step);
        await sut.StopAsync(CancellationToken.None);

        // Assert
        _health.Received(1).Stopped(NotificationChannel.Telegram);
    }

    [Fact]
    public async Task StopAsync_ShouldEndTheLoop_WhenTheHostShutsDownDuringTheBackOff()
    {
        // Arrange
        var logger = new LogSignal<RemoteCommandListenerService>();
        var failed = logger.Reached(LogLevel.Error);
        _configs.GetAllAsync(Arg.Any<CancellationToken>())
            .Returns<IReadOnlyList<NotificationChannelConfig>>(_ => throw new InvalidOperationException("database is locked"));
        var sut = CreateSut(logger);
        await sut.StartAsync(CancellationToken.None);
        await failed.ObservedAsync();

        // Act
        await sut.StopWithinGuardAsync();

        // Assert
        Assert.True(sut.ExecuteTask!.IsCompleted);
        Assert.False(sut.ExecuteTask.IsFaulted);
    }

    [Fact]
    public async Task StopAsync_ShouldEndTheLoop_WhenTheHostShutsDown()
    {
        // Arrange
        _configs.GetAllAsync(Arg.Any<CancellationToken>()).Returns([Telegram(enabled: true)]);
        var listening = SignalOnReceive(call: 1);
        var sut = CreateSut();
        await sut.StartAsync(CancellationToken.None);
        await listening.Task.ObservedAsync();

        // Act
        await sut.StopWithinGuardAsync();

        // Assert
        Assert.True(sut.ExecuteTask!.IsCompleted);
        Assert.False(sut.ExecuteTask.IsFaulted);
    }
}
