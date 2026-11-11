using Vyzio.Core.Entities;

namespace Vyzio.Tests.Entities;

public class FrigateEventIdTests
{
    [Theory]
    [InlineData("1700000000.123456-abc123", true)]
    [InlineData("1731340800.5-z9y8x7", true)]
    [InlineData("1700000000.123456-ABC123", false)]
    [InlineData("1700000000-abc123", false)]
    [InlineData("1700000000.123456-abc12", false)]
    [InlineData("1700000000.123456-abc123\nFORGED", false)]
    [InlineData("1700000000.123456-abc123\n", false)]
    [InlineData("../config", false)]
    [InlineData("", false)]
    [InlineData(null, false)]
    public void IsWellFormed_ShouldAcceptOnlyFrigatesShape_WhenGivenACandidateId(string? candidate, bool expected)
    {
        // Arrange & Act
        var wellFormed = FrigateEventId.IsWellFormed(candidate);

        // Assert
        Assert.Equal(expected, wellFormed);
    }
}
