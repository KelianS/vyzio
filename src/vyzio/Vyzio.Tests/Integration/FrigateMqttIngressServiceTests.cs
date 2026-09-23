using System.Net;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;
using MQTTnet;
using MQTTnet.Server;
using NSubstitute;
using Vyzio.Api.Integration.Frigate;
using Vyzio.Application.UseCases.Frigate;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.Configuration;
using Vyzio.Tests.Services.Hosting;

namespace Vyzio.Tests.Integration;

// Runs the ingress against a real in-process broker: the MQTT client is the part a fake would hide.
public sealed class FrigateMqttIngressServiceTests : IAsyncDisposable
{
    private const string Topic = "frigate/events";

    private readonly int _port = BackgroundLoop.ClosedPort();
    private readonly IDetectionNotificationQueue _queue = Substitute.For<IDetectionNotificationQueue>();
    private readonly FakeTimeProvider _time = BackgroundLoop.ClockAt("2026-09-23T10:00:00+00:00");
    private readonly TaskCompletionSource _subscribed = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private readonly FrigateMqttConnection _connection = new();
    private MqttServer? _broker;

    private FrigateMqttIngressService CreateSut(ILogger<FrigateMqttIngressService>? logger = null) => new(
        BackgroundLoop.Scopes(services => services.AddSingleton(new IngestFrigateEventUseCase(
            new FrigateEventContractAdapter(new FrigateLabelFilter()),
            _queue,
            NullLogger<IngestFrigateEventUseCase>.Instance))),
        new VyzioRuntimeSettings
        {
            Frigate = new VyzioRuntimeSettings.FrigateSettings
            {
                Mqtt = new VyzioRuntimeSettings.MqttSettings
                {
                    Host = "127.0.0.1",
                    Port = _port,
                    Topic = Topic,
                    ClientId = "vyzio-test",
                },
            },
        },
        _connection,
        _time,
        logger ?? NullLogger<FrigateMqttIngressService>.Instance);

    private async Task StartBrokerAsync()
    {
        var factory = new MqttServerFactory();
        var options = factory.CreateServerOptionsBuilder()
            .WithDefaultEndpoint()
            .WithDefaultEndpointBoundIPAddress(IPAddress.Loopback)
            .WithDefaultEndpointPort(_port)
            .Build();
        _broker = factory.CreateMqttServer(options);
        _broker.ClientSubscribedTopicAsync += _ =>
        {
            _subscribed.TrySetResult();
            return Task.CompletedTask;
        };
        await _broker.StartAsync();
    }

    private Task PublishAsync(string lifecycle, string eventId)
    {
        var payload = $$$"""
            {"type":"{{{lifecycle}}}","after":{"id":"{{{eventId}}}","camera":"front_door","label":"person",
            "top_score":0.98,"start_time":1715353200,"has_clip":true,"has_snapshot":true}}
            """;
        var message = new MqttApplicationMessageBuilder().WithTopic(Topic).WithPayload(payload).Build();
        return _broker!.InjectApplicationMessage(new InjectedMqttApplicationMessage(message) { SenderClientId = "frigate" });
    }

    private TaskCompletionSource SignalOnQueued(string eventId)
    {
        var queued = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        _queue.TryEnqueue(Arg.Is<FrigateDetection>(d => d.EventId == eventId)).Returns(_ =>
        {
            queued.TrySetResult();
            return true;
        });
        return queued;
    }

    [Fact]
    public async Task ExecuteAsync_ShouldQueueADetection_WhenFrigateReportsTheEndOfAnEvent()
    {
        // Arrange
        await StartBrokerAsync();
        var queued = SignalOnQueued("evt-1");
        var sut = CreateSut();
        await sut.StartAsync(CancellationToken.None);
        await _subscribed.Task.ObservedAsync();

        // Act
        await PublishAsync("end", "evt-1");
        await queued.Task.ObservedAsync();
        await sut.StopAsync(CancellationToken.None);

        // Assert
        _queue.Received(1).TryEnqueue(Arg.Is<FrigateDetection>(d => d.EventId == "evt-1" && d.Camera == "front_door"));
    }

    [Fact]
    public async Task ExecuteAsync_ShouldQueueNothing_WhenFrigateOnlyReportsTheStartOfAnEvent()
    {
        // Arrange
        await StartBrokerAsync();
        var queued = SignalOnQueued("evt-2");
        var sut = CreateSut();
        await sut.StartAsync(CancellationToken.None);
        await _subscribed.Task.ObservedAsync();

        // Act
        await PublishAsync("new", "evt-1");
        await PublishAsync("end", "evt-2");
        await queued.Task.ObservedAsync();
        await sut.StopAsync(CancellationToken.None);

        // Assert
        _queue.DidNotReceive().TryEnqueue(Arg.Is<FrigateDetection>(d => d.EventId == "evt-1"));
    }

    [Fact]
    public async Task ExecuteAsync_ShouldSubscribe_WhenTheBrokerComesUpAfterVyzio()
    {
        // Arrange
        var logger = new LogSignal<FrigateMqttIngressService>();
        var failed = logger.Reached(LogLevel.Error);
        var sut = CreateSut(logger);
        await sut.StartAsync(CancellationToken.None);
        await failed.ObservedAsync();

        // Act
        await StartBrokerAsync();
        await _time.AdvanceUntilAsync(_subscribed.Task, TimeSpan.FromSeconds(5));
        await sut.StopAsync(CancellationToken.None);

        // Assert
        Assert.True(_subscribed.Task.IsCompletedSuccessfully);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldReportTheSubscriptionLost_WhenTheBrokerStops()
    {
        // Arrange
        // The ingress logs the subscription once it holds it, and an error once a lost connection is handled.
        await StartBrokerAsync();
        var logger = new LogSignal<FrigateMqttIngressService>();
        var subscribed = logger.Reached(LogLevel.Information);
        var failed = logger.Reached(LogLevel.Error);
        var sut = CreateSut(logger);
        await sut.StartAsync(CancellationToken.None);
        await subscribed.ObservedAsync();
        var before = _connection.State;

        // Act
        await _broker!.StopAsync();
        await failed.ObservedAsync();
        await sut.StopAsync(CancellationToken.None);

        // Assert
        Assert.Equal(FrigateMqttState.Subscribed, before);
        Assert.Equal(FrigateMqttState.Lost, _connection.State);
    }

    [Fact]
    public async Task StopAsync_ShouldEndTheLoop_WhenTheHostShutsDown()
    {
        // Arrange
        await StartBrokerAsync();
        var sut = CreateSut();
        await sut.StartAsync(CancellationToken.None);
        await _subscribed.Task.ObservedAsync();

        // Act
        await sut.StopWithinGuardAsync();

        // Assert
        Assert.True(sut.ExecuteTask!.IsCompleted);
        Assert.False(sut.ExecuteTask.IsFaulted);
    }

    public async ValueTask DisposeAsync()
    {
        if (_broker is null) return;
        await _broker.StopAsync();
        _broker.Dispose();
    }
}
