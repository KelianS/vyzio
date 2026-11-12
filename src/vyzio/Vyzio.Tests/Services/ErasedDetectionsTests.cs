using Vyzio.Infrastructure.Services;

namespace Vyzio.Tests.Services;

public class ErasedDetectionsTests
{
    [Fact]
    public void Contains_ShouldAnswerTrue_WhenTheDetectionWasErased()
    {
        // Arrange
        var sut = new ErasedDetections();

        // Act
        sut.Remember("evt-1");

        // Assert
        Assert.True(sut.Contains("evt-1"));
    }

    [Fact]
    public void Contains_ShouldAnswerFalse_WhenAnotherDetectionWasErased()
    {
        // Arrange
        var sut = new ErasedDetections();

        // Act
        sut.Remember("evt-1");

        // Assert
        Assert.False(sut.Contains("evt-2"));
    }
}
