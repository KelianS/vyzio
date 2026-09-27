using NSubstitute;
using Vyzio.Application.UseCases.DetectionEvents;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Tests.UseCases;

// Recognition is whole: a profile resolves on every camera (ADR-58).
public class DetectionProfileResolverTests
{
    private readonly IProfileRepository _profiles = Substitute.For<IProfileRepository>();

    private DetectionProfileResolver CreateSut() => new(_profiles);

    [Fact]
    public async Task ResolveProfileAsync_ShouldReturnTheProfile_WhenItBearsTheIdentityWhateverItsCase()
    {
        // Arrange
        var profile = new Profile { Name = "Alice" };
        _profiles.GetAllAsync(Arg.Any<CancellationToken>()).Returns([profile]);

        // Act
        var resolved = await CreateSut().ResolveProfileAsync("alice");

        // Assert
        Assert.Same(profile, resolved);
    }

    [Fact]
    public async Task ResolveProfileAsync_ShouldReturnNull_WhenNoProfileBearsThatName()
    {
        // Arrange
        _profiles.GetAllAsync(Arg.Any<CancellationToken>()).Returns([new Profile { Name = "Alice" }]);

        // Act
        var resolved = await CreateSut().ResolveProfileAsync("Mallory");

        // Assert
        Assert.Null(resolved);
    }

    [Fact]
    public async Task ResolveProfileAsync_ShouldReturnNullWithoutReadingProfiles_WhenThereIsNoIdentity()
    {
        // Arrange
        var sut = CreateSut();

        // Act
        var resolved = await sut.ResolveProfileAsync(null);

        // Assert
        Assert.Null(resolved);
        await _profiles.DidNotReceive().GetAllAsync(Arg.Any<CancellationToken>());
    }
}
