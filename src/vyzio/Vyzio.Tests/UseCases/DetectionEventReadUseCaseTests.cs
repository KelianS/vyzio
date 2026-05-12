using NSubstitute;
using Vyzio.Application.UseCases.DetectionEvents;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Tests.UseCases;

public class GetRecentDetectionEventsUseCaseTests
{
    private readonly IDetectionEventRepository _repo = Substitute.For<IDetectionEventRepository>();
    private readonly GetRecentDetectionEventsUseCase _sut;

    public GetRecentDetectionEventsUseCaseTests()
        => _sut = new GetRecentDetectionEventsUseCase(_repo, new DetectionEventContractProjector());

    [Fact]
    public async Task Execute_returns_projected_recent_events()
    {
        _repo.GetRecentAsync(20, Arg.Any<CancellationToken>()).Returns(
        [
            new DetectionEvent
            {
                Id = "evt-001",
                FrigateEventId = "frigate-001",
                Lifecycle = "new",
                Camera = "front-door",
                Label = "person",
                Identity = "Alice"
            }
        ]);

        var result = await _sut.ExecuteAsync();

        var detection = Assert.Single(result);
        Assert.Equal("evt-001", detection.EventId);
        Assert.Equal("Alice", detection.Identity);
    }

    [Fact]
    public async Task Execute_clamps_limit_before_querying_repository()
    {
        await _sut.ExecuteAsync(500);

        await _repo.Received(1).GetRecentAsync(100, Arg.Any<CancellationToken>());
    }
}

public class GetProfileDetectionEventsUseCaseTests
{
    private readonly IDetectionEventRepository _repo = Substitute.For<IDetectionEventRepository>();
    private readonly GetProfileDetectionEventsUseCase _sut;

    public GetProfileDetectionEventsUseCaseTests()
        => _sut = new GetProfileDetectionEventsUseCase(_repo, new DetectionEventContractProjector());

    [Fact]
    public async Task Execute_returns_projected_events_for_the_requested_profile()
    {
        _repo.GetByProfileAsync("profile-123", 5, Arg.Any<CancellationToken>()).Returns(
        [
            new DetectionEvent
            {
                Id = "evt-010",
                FrigateEventId = "frigate-010",
                Lifecycle = "update",
                Camera = "garage",
                Label = "car",
                ProfileId = "profile-123"
            }
        ]);

        var result = await _sut.ExecuteAsync("profile-123", 5);

        var detection = Assert.Single(result);
        Assert.Equal("evt-010", detection.EventId);
        Assert.Equal("profile-123", detection.ProfileId);
    }

    [Fact]
    public async Task Execute_throws_when_profile_id_is_blank()
    {
        await Assert.ThrowsAsync<ArgumentException>(() => _sut.ExecuteAsync(" "));
    }
}