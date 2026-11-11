using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using NSubstitute.ExceptionExtensions;
using Vyzio.Application.UseCases.DetectionEvents;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Tests.UseCases;

public class DeleteDetectionUseCaseTests
{
    private readonly IFrigateDetectionEraser _eraser = Substitute.For<IFrigateDetectionEraser>();
    private readonly INotificationRepository _notifications = Substitute.For<INotificationRepository>();

    private DeleteDetectionUseCase CreateSut()
        => new(_eraser, _notifications, NullLogger<DeleteDetectionUseCase>.Instance);

    [Fact]
    public async Task ExecuteAsync_ShouldRemoveTheDetectionsNotificationRows_WhenFrigateErasedIt()
    {
        // Arrange
        _eraser.EraseAsync("evt-1", Arg.Any<CancellationToken>()).Returns(DetectionErasure.Erased);

        // Act
        var erasure = await CreateSut().ExecuteAsync("evt-1");

        // Assert
        Assert.Equal(DetectionErasure.Erased, erasure);
        await _notifications.Received(1).DeleteForEventAsync("evt-1", Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldKeepTheNotificationRows_WhenFrigateFailsMidErasure()
    {
        // Arrange
        _eraser.EraseAsync("evt-1", Arg.Any<CancellationToken>())
            .ThrowsAsync(new DetectionErasureFailedException("POST /api/reviews/delete answered 500"));

        // Act
        var act = () => CreateSut().ExecuteAsync("evt-1");

        // Assert
        await Assert.ThrowsAsync<DetectionErasureFailedException>(act);
        await _notifications.DidNotReceiveWithAnyArgs().DeleteForEventAsync(default!, default);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldKeepTheNotificationRows_WhenTheDetectionIsStillInProgress()
    {
        // Arrange
        _eraser.EraseAsync("evt-1", Arg.Any<CancellationToken>()).Returns(DetectionErasure.InProgress);

        // Act
        var erasure = await CreateSut().ExecuteAsync("evt-1");

        // Assert
        Assert.Equal(DetectionErasure.InProgress, erasure);
        await _notifications.DidNotReceiveWithAnyArgs().DeleteForEventAsync(default!, default);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldAnswerNotFoundAndClearLeftoverRows_WhenFrigateKnowsNoSuchDetection()
    {
        // Arrange
        _eraser.EraseAsync("unknown", Arg.Any<CancellationToken>()).Returns(DetectionErasure.NotFound);

        // Act
        var erasure = await CreateSut().ExecuteAsync("unknown");

        // Assert
        Assert.Equal(DetectionErasure.NotFound, erasure);
        await _notifications.Received(1).DeleteForEventAsync("unknown", Arg.Any<CancellationToken>());
    }
}
