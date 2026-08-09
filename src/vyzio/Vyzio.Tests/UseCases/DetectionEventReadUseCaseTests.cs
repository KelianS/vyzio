using NSubstitute;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Application.UseCases.DetectionEvents;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Tests.UseCases;

public abstract class DetectionReadTestBase
{
    protected readonly IFrigateEventReader Events = Substitute.For<IFrigateEventReader>();
    protected readonly ICameraRepository Cameras = Substitute.For<ICameraRepository>();
    protected readonly IProfileRepository Profiles = Substitute.For<IProfileRepository>();
    protected readonly IProfileCameraLinkRepository Links = Substitute.For<IProfileCameraLinkRepository>();

    protected readonly IRecordingSettingsRepository RecordingSettings =
        Substitute.For<IRecordingSettingsRepository>();

    protected DetectionEventContractProjector Projector()
    {
        RecordingSettings.GetAsync(Arg.Any<CancellationToken>())
            .Returns(Vyzio.Core.Entities.RecordingSettings.CreateDefault());

        return new DetectionEventContractProjector(
            new CameraDirectory(Cameras), new DetectionProfileResolver(Profiles, Links), RecordingSettings);
    }

    protected static FrigateDetection Detection(string eventId, DateTimeOffset? occurredAt = null)
        => new(eventId, "front_door", "person", null, 0.9f,
            occurredAt ?? DateTimeOffset.Parse("2026-05-10T10:15:00+00:00"),
            HasClip: true, HasSnapshot: true);
}

public class GetRecentDetectionEventsUseCaseTests : DetectionReadTestBase
{
    [Fact]
    public async Task Execute_returns_what_Frigate_answers()
    {
        Events.QueryAsync(Arg.Any<FrigateDetectionQuery>(), Arg.Any<CancellationToken>())
            .Returns([Detection("frigate-001")]);

        var result = await new GetRecentDetectionEventsUseCase(Events, Projector()).ExecuteAsync();

        var detection = Assert.Single(result);
        Assert.Equal("frigate-001", detection.EventId);
    }

    [Fact]
    public async Task Execute_clamps_limit_before_querying_Frigate()
    {
        await new GetRecentDetectionEventsUseCase(Events, Projector()).ExecuteAsync(500);

        await Events.Received(1).QueryAsync(
            Arg.Is<FrigateDetectionQuery>(query => query.Limit == 100),
            Arg.Any<CancellationToken>());
    }
}

public class GetProfileDetectionEventsUseCaseTests : DetectionReadTestBase
{
    [Fact]
    public async Task Execute_asks_Frigate_for_the_name_the_profile_bears()
    {
        var profile = new Profile { Name = "Alice" };
        Profiles.GetByIdAsync(profile.Id, Arg.Any<CancellationToken>()).Returns(profile);
        Events.QueryAsync(Arg.Any<FrigateDetectionQuery>(), Arg.Any<CancellationToken>())
            .Returns([Detection("frigate-010")]);

        var result = await new GetProfileDetectionEventsUseCase(Profiles, Events, Projector())
            .ExecuteAsync(profile.Id, 5);

        Assert.Single(result);
        await Events.Received(1).QueryAsync(
            Arg.Is<FrigateDetectionQuery>(query => query.Identity == "Alice" && query.Limit == 5),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Execute_returns_nothing_when_the_profile_is_gone()
    {
        Profiles.GetByIdAsync("profile-404", Arg.Any<CancellationToken>()).Returns((Profile?)null);

        var result = await new GetProfileDetectionEventsUseCase(Profiles, Events, Projector())
            .ExecuteAsync("profile-404");

        Assert.Empty(result);
        await Events.DidNotReceive().QueryAsync(Arg.Any<FrigateDetectionQuery>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Execute_throws_when_profile_id_is_blank()
    {
        var sut = new GetProfileDetectionEventsUseCase(Profiles, Events, Projector());

        await Assert.ThrowsAsync<ArgumentException>(() => sut.ExecuteAsync(" "));
    }
}

public class GetDetectionHistoryUseCaseTests : DetectionReadTestBase
{
    private GetDetectionHistoryUseCase CreateSut() => new(Profiles, Events, Projector());

    [Fact]
    public async Task Execute_offers_a_cursor_only_while_a_full_page_comes_back()
    {
        var oldest = DateTimeOffset.Parse("2026-05-10T08:00:00+00:00");
        Events.QueryAsync(Arg.Any<FrigateDetectionQuery>(), Arg.Any<CancellationToken>())
            .Returns([Detection("frigate-001"), Detection("frigate-002", oldest)]);

        var page = await CreateSut().ExecuteAsync(new DetectionHistoryQuery(Limit: 2));

        Assert.Equal(2, page.Items.Count);
        Assert.Equal(oldest.ToUnixTimeMilliseconds().ToString(), page.NextCursor);
    }

    [Fact]
    public async Task Execute_stops_offering_a_cursor_on_the_last_page()
    {
        Events.QueryAsync(Arg.Any<FrigateDetectionQuery>(), Arg.Any<CancellationToken>())
            .Returns([Detection("frigate-001")]);

        var page = await CreateSut().ExecuteAsync(new DetectionHistoryQuery(Limit: 2));

        Assert.Null(page.NextCursor);
    }

    [Fact]
    public async Task Execute_reads_the_cursor_as_the_moment_to_read_before()
    {
        var cursor = DateTimeOffset.Parse("2026-05-10T08:00:00+00:00");

        await CreateSut().ExecuteAsync(
            new DetectionHistoryQuery(Cursor: cursor.ToUnixTimeMilliseconds().ToString()));

        await Events.Received(1).QueryAsync(
            Arg.Is<FrigateDetectionQuery>(query => query.Before == cursor),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Execute_translates_a_profile_filter_into_the_name_Frigate_recognized()
    {
        var profile = new Profile { Name = "Alice" };
        Profiles.GetByIdAsync(profile.Id, Arg.Any<CancellationToken>()).Returns(profile);

        await CreateSut().ExecuteAsync(new DetectionHistoryQuery(ProfileId: profile.Id));

        await Events.Received(1).QueryAsync(
            Arg.Is<FrigateDetectionQuery>(query => query.Identity == "Alice"),
            Arg.Any<CancellationToken>());
    }
}
