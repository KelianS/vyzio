using NSubstitute;
using Vyzio.Application.UseCases.DetectionEvents;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Tests.UseCases;

// Contract tests for ADR-15: profile-camera link filtering, now applied when reading the history.
public class DetectionProfileResolverTests
{
    private readonly IProfileRepository _profiles = Substitute.For<IProfileRepository>();
    private readonly IProfileCameraLinkRepository _links = Substitute.For<IProfileCameraLinkRepository>();

    private DetectionProfileResolver CreateSut() => new(_profiles, _links);

    [Fact]
    public async Task ResolveProfileIdAsync_returns_profile_when_linked_to_camera()
    {
        var profile = new Profile { Name = "Alice" };
        _profiles.GetAllAsync(Arg.Any<CancellationToken>()).Returns([profile]);
        _links.GetByProfileIdAsync(profile.Id, Arg.Any<CancellationToken>())
            .Returns([new ProfileCameraLink { ProfileId = profile.Id, CameraId = "cam-1", Enabled = true }]);

        Assert.Equal(profile.Id, await CreateSut().ResolveProfileIdAsync("Alice", "cam-1"));
    }

    [Fact]
    public async Task ResolveProfileIdAsync_returns_null_when_camera_not_in_active_links()
    {
        var profile = new Profile { Name = "Bob" };
        _profiles.GetAllAsync(Arg.Any<CancellationToken>()).Returns([profile]);
        _links.GetByProfileIdAsync(profile.Id, Arg.Any<CancellationToken>())
            .Returns([new ProfileCameraLink { ProfileId = profile.Id, CameraId = "cam-garage", Enabled = true }]);

        Assert.Null(await CreateSut().ResolveProfileIdAsync("Bob", "cam-1"));
    }

    [Fact]
    public async Task ResolveProfileIdAsync_returns_profile_when_it_has_no_links()
    {
        // No link = recognized on every camera (ADR-15).
        var profile = new Profile { Name = "Carol" };
        _profiles.GetAllAsync(Arg.Any<CancellationToken>()).Returns([profile]);
        _links.GetByProfileIdAsync(profile.Id, Arg.Any<CancellationToken>()).Returns([]);

        Assert.Equal(profile.Id, await CreateSut().ResolveProfileIdAsync("Carol", "any-camera"));
    }

    [Fact]
    public async Task ResolveProfileIdAsync_returns_null_when_no_profile_bears_that_name()
    {
        _profiles.GetAllAsync(Arg.Any<CancellationToken>()).Returns([new Profile { Name = "Alice" }]);

        Assert.Null(await CreateSut().ResolveProfileIdAsync("Mallory", "cam-1"));
    }

    [Fact]
    public async Task ResolveProfileIdAsync_returns_null_without_identity()
    {
        Assert.Null(await CreateSut().ResolveProfileIdAsync(null, "cam-1"));
        await _profiles.DidNotReceive().GetAllAsync(Arg.Any<CancellationToken>());
    }
}
