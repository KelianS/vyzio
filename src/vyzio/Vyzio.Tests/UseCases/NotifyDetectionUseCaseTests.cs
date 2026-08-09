using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Vyzio.Application.UseCases.Notifications;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Tests.UseCases;

public class NotifyDetectionUseCaseTests
{
    private readonly IFrigateEventReader _eventReader = Substitute.For<IFrigateEventReader>();
    private readonly IDetectionNotificationDispatcher _dispatcher = Substitute.For<IDetectionNotificationDispatcher>();
    private readonly NotifyDetectionUseCase _sut;

    public NotifyDetectionUseCaseTests()
    {
        _sut = new NotifyDetectionUseCase(
            _eventReader, _dispatcher, NullLogger<NotifyDetectionUseCase>.Instance);
    }

    [Fact]
    public async Task ExecuteAsync_enriches_the_identity_before_dispatching()
    {
        _eventReader.TryGetIdentityAsync("frigate-evt-201", Arg.Any<CancellationToken>()).Returns("Alice");

        await _sut.ExecuteAsync(Detection("frigate-evt-201"));

        await _dispatcher.Received(1).ExecuteAsync(
            Arg.Is<FrigateDetection>(detection =>
                detection.EventId == "frigate-evt-201" && detection.Identity == "Alice"),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_keeps_the_realtime_payload_when_rest_enrichment_fails()
    {
        _eventReader.TryGetIdentityAsync("frigate-evt-202", Arg.Any<CancellationToken>())
            .Returns(Task.FromException<string?>(new HttpRequestException("Frigate unavailable")));

        await _sut.ExecuteAsync(Detection("frigate-evt-202"));

        await _dispatcher.Received(1).ExecuteAsync(
            Arg.Is<FrigateDetection>(detection =>
                detection.EventId == "frigate-evt-202" && detection.Identity == null),
            Arg.Any<CancellationToken>());
    }

    private static FrigateDetection Detection(string eventId)
        => new(eventId, "front_door", "person", Identity: null, 0.97f,
            DateTimeOffset.Parse("2026-05-12T09:00:00+00:00"), HasClip: true, HasSnapshot: true);
}
