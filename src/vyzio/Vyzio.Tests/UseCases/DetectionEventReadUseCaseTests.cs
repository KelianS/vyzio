using System.Globalization;
using NSubstitute;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Application.UseCases.DetectionEvents;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Tests.UseCases;

public abstract class DetectionReadTestBase
{
    protected IFrigateEventReader Events { get; } = Substitute.For<IFrigateEventReader>();
    protected ICameraRepository Cameras { get; } = Substitute.For<ICameraRepository>();
    protected IProfileRepository Profiles { get; } = Substitute.For<IProfileRepository>();

    protected IRecordingSettingsRepository RecordingSettings { get; } =
        Substitute.For<IRecordingSettingsRepository>();

    protected DetectionEventContractProjector Projector()
    {
        RecordingSettings.GetAsync(Arg.Any<CancellationToken>())
            .Returns(Vyzio.Core.Entities.RecordingSettings.CreateDefault());

        return new DetectionEventContractProjector(
            new CameraDirectory(Cameras), new DetectionProfileResolver(Profiles), RecordingSettings);
    }

    protected static FrigateDetection Detection(string eventId, DateTimeOffset? occurredAt = null)
        => new(eventId, "front_door", "person", null, 0.9f,
            occurredAt ?? DateTimeOffset.Parse("2026-05-10T10:15:00+00:00", CultureInfo.InvariantCulture),
            HasClip: true, HasSnapshot: true);
}

public class GetRecentDetectionEventsUseCaseTests : DetectionReadTestBase
{
    [Fact]
    public async Task ExecuteAsync_ShouldReturnWhatFrigateAnswers_WhenRecentDetectionsAreAsked()
    {
        Events.QueryAsync(Arg.Any<FrigateDetectionQuery>(), Arg.Any<CancellationToken>())
            .Returns([Detection("frigate-001")]);

        var result = await new GetRecentDetectionEventsUseCase(Events, Projector()).ExecuteAsync();

        var detection = Assert.Single(result);
        Assert.Equal("frigate-001", detection.EventId);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldClampTheLimitBeforeQueryingFrigate_WhenTheLimitIsTooHigh()
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
    public async Task ExecuteAsync_ShouldAskFrigateForTheNameTheProfileBears_WhenTheProfileExists()
    {
        var profile = new Profile { Name = "Alice" };
        Profiles.GetByIdAsync(profile.Id, Arg.Any<CancellationToken>()).Returns(profile);
        Events.QueryAsync(Arg.Any<FrigateDetectionQuery>(), Arg.Any<CancellationToken>())
            .Returns([Detection("frigate-010")]);

        var result = await new GetProfileDetectionEventsUseCase(Profiles, Events, Projector())
            .ExecuteAsync(profile.Id, 5);

        Assert.Single(result);
        await Events.Received(1).QueryAsync(
            Arg.Is<FrigateDetectionQuery>(query => string.Join(',', query.Identities!) == "Alice" && query.Limit == 5),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldReturnNothingWithoutQuerying_WhenTheProfileIsGone()
    {
        Profiles.GetByIdAsync("profile-404", Arg.Any<CancellationToken>()).Returns((Profile?)null);

        var result = await new GetProfileDetectionEventsUseCase(Profiles, Events, Projector())
            .ExecuteAsync("profile-404");

        Assert.Empty(result);
        await Events.DidNotReceive().QueryAsync(Arg.Any<FrigateDetectionQuery>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldThrow_WhenTheProfileIdIsBlank()
    {
        var sut = new GetProfileDetectionEventsUseCase(Profiles, Events, Projector());

        await Assert.ThrowsAsync<ArgumentException>(() => sut.ExecuteAsync(" "));
    }
}

public class GetDetectionHistoryUseCaseTests : DetectionReadTestBase
{
    private GetDetectionHistoryUseCase CreateSut() => new(Profiles, Events, Projector());

    [Fact]
    public async Task ExecuteAsync_ShouldOfferTheOldestMomentAsCursor_WhenAFullPageComesBack()
    {
        var oldest = DateTimeOffset.Parse("2026-05-10T08:00:00+00:00", CultureInfo.InvariantCulture);
        Events.QueryAsync(Arg.Any<FrigateDetectionQuery>(), Arg.Any<CancellationToken>())
            .Returns([Detection("frigate-001"), Detection("frigate-002", oldest)]);

        var page = await CreateSut().ExecuteAsync(new DetectionHistoryQuery(Limit: 2));

        Assert.Equal(2, page.Items.Count);
        Assert.Equal(oldest.ToUnixTimeMilliseconds().ToString(CultureInfo.InvariantCulture), page.NextCursor);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldOfferNoCursor_WhenThePageIsTheLast()
    {
        Events.QueryAsync(Arg.Any<FrigateDetectionQuery>(), Arg.Any<CancellationToken>())
            .Returns([Detection("frigate-001")]);

        var page = await CreateSut().ExecuteAsync(new DetectionHistoryQuery(Limit: 2));

        Assert.Null(page.NextCursor);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldReadBeforeTheCursorMoment_WhenACursorIsGiven()
    {
        var cursor = DateTimeOffset.Parse("2026-05-10T08:00:00+00:00", CultureInfo.InvariantCulture);

        await CreateSut().ExecuteAsync(
            new DetectionHistoryQuery(Cursor: cursor.ToUnixTimeMilliseconds().ToString(CultureInfo.InvariantCulture)));

        await Events.Received(1).QueryAsync(
            Arg.Is<FrigateDetectionQuery>(query => query.Before == cursor),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldFilterOnTheNamesFrigateRecognizes_WhenSeveralPeopleAreAsked()
    {
        // Arrange
        var alice = new Profile { Name = "Alice" };
        var bob = new Profile { Name = "Bob" };
        Profiles.GetByIdAsync(alice.Id, Arg.Any<CancellationToken>()).Returns(alice);
        Profiles.GetByIdAsync(bob.Id, Arg.Any<CancellationToken>()).Returns(bob);

        // Act
        await CreateSut().ExecuteAsync(new DetectionHistoryQuery(ProfileIds: [alice.Id, bob.Id]));

        // Assert
        await Events.Received(1).QueryAsync(
            Arg.Is<FrigateDetectionQuery>(query => string.Join(',', query.Identities!) == "Alice,Bob"),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldKeepThePeopleStillKnown_WhenOneOfThoseAskedIsGone()
    {
        // Arrange
        var alice = new Profile { Name = "Alice" };
        Profiles.GetByIdAsync(alice.Id, Arg.Any<CancellationToken>()).Returns(alice);
        Profiles.GetByIdAsync("profile-404", Arg.Any<CancellationToken>()).Returns((Profile?)null);

        // Act
        await CreateSut().ExecuteAsync(new DetectionHistoryQuery(ProfileIds: [alice.Id, "profile-404"]));

        // Assert
        await Events.Received(1).QueryAsync(
            Arg.Is<FrigateDetectionQuery>(query => string.Join(',', query.Identities!) == "Alice"),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldAnswerAnEmptyPageWithoutAskingFrigate_WhenEveryPersonAskedIsGone()
    {
        // Arrange
        Profiles.GetByIdAsync("profile-404", Arg.Any<CancellationToken>()).Returns((Profile?)null);

        // Act
        var page = await CreateSut().ExecuteAsync(new DetectionHistoryQuery(ProfileIds: ["profile-404"]));

        // Assert
        Assert.Empty(page.Items);
        await Events.DidNotReceive().QueryAsync(Arg.Any<FrigateDetectionQuery>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldAskFrigateForEveryCameraAndType_WhenSeveralAreAsked()
    {
        // Act
        await CreateSut().ExecuteAsync(
            new DetectionHistoryQuery(Cameras: ["front_door", "garage"], Labels: ["car", "dog"]));

        // Assert
        await Events.Received(1).QueryAsync(
            Arg.Is<FrigateDetectionQuery>(query =>
                string.Join(',', query.Cameras!) == "front_door,garage"
                && string.Join(',', query.Labels!) == "car,dog"),
            Arg.Any<CancellationToken>());
    }
}
