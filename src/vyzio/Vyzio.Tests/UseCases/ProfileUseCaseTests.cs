using NSubstitute;
using Vyzio.Application.DTOs.Profiles;
using Vyzio.Application.UseCases.Profiles;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Tests.UseCases;

public class CreateProfileUseCaseTests
{
    private readonly IProfileRepository _repo = Substitute.For<IProfileRepository>();
    private readonly CreateProfileUseCase _sut;

    public CreateProfileUseCaseTests() => _sut = new CreateProfileUseCase(_repo);

    [Fact]
    public async Task ExecuteAsync_ShouldReturnTheRequestedFields_WhenTheProfileIsCreated()
    {
        var request = new CreateProfileRequest("Alice", "household", "notify");

        var result = await _sut.ExecuteAsync(request);

        Assert.Equal("Alice", result.Name);
        Assert.Equal("household", result.Category);
        Assert.Equal("notify", result.AlertMode);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldAddTheProfileOnce_WhenTheProfileIsCreated()
    {
        var request = new CreateProfileRequest("Bob");

        await _sut.ExecuteAsync(request);

        await _repo.Received(1).AddAsync(Arg.Is<Profile>(p => p.Name == "Bob"), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldAssignAnId_WhenTheProfileIsCreated()
    {
        var result = await _sut.ExecuteAsync(new CreateProfileRequest("Carol"));

        Assert.NotEmpty(result.Id);
    }
}

public class GetProfileByIdUseCaseTests
{
    private readonly IProfileRepository _repo = Substitute.For<IProfileRepository>();
    private readonly GetProfileByIdUseCase _sut;

    public GetProfileByIdUseCaseTests() => _sut = new GetProfileByIdUseCase(_repo);

    [Fact]
    public async Task ExecuteAsync_ShouldReturnTheProfile_WhenItExists()
    {
        var profile = new Profile { Name = "Alice" };
        _repo.GetByIdAsync(profile.Id, Arg.Any<CancellationToken>()).Returns(profile);

        var result = await _sut.ExecuteAsync(profile.Id);

        Assert.NotNull(result);
        Assert.Equal("Alice", result.Name);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldReturnNull_WhenTheProfileDoesNotExist()
    {
        _repo.GetByIdAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns((Profile?)null);

        var result = await _sut.ExecuteAsync("unknown-id");

        Assert.Null(result);
    }
}

public class DeleteProfileUseCaseTests
{
    private readonly IProfileRepository _repo = Substitute.For<IProfileRepository>();
    private readonly DeleteProfileUseCase _sut;

    public DeleteProfileUseCaseTests() => _sut = new DeleteProfileUseCase(_repo);

    [Fact]
    public async Task ExecuteAsync_ShouldDeleteAndReturnTrue_WhenTheProfileExists()
    {
        var profile = new Profile { Name = "Alice" };
        _repo.GetByIdAsync(profile.Id, Arg.Any<CancellationToken>()).Returns(profile);

        var result = await _sut.ExecuteAsync(profile.Id);

        Assert.True(result);
        await _repo.Received(1).DeleteAsync(profile.Id, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldReturnFalseWithoutDeleting_WhenTheProfileDoesNotExist()
    {
        _repo.GetByIdAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns((Profile?)null);

        var result = await _sut.ExecuteAsync("ghost-id");

        Assert.False(result);
        await _repo.DidNotReceive().DeleteAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
    }
}

public class UpdateProfileUseCaseTests
{
    private readonly IProfileRepository _repo = Substitute.For<IProfileRepository>();
    private readonly UpdateProfileUseCase _sut;

    public UpdateProfileUseCaseTests() => _sut = new UpdateProfileUseCase(_repo);

    [Fact]
    public async Task ExecuteAsync_ShouldSaveAndReturnTheUpdatedProfile_WhenTheProfileExists()
    {
        var profile = new Profile { Name = "Old" };
        _repo.GetByIdAsync(profile.Id, Arg.Any<CancellationToken>()).Returns(profile);
        var request = new UpdateProfileRequest("New", "delivery", "silent");

        var result = await _sut.ExecuteAsync(profile.Id, request);

        Assert.NotNull(result);
        Assert.Equal("New", result.Name);
        Assert.Equal("delivery", result.Category);
        await _repo.Received(1).UpdateAsync(Arg.Is<Profile>(p => p.Name == "New"), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldReturnNull_WhenTheProfileDoesNotExist()
    {
        _repo.GetByIdAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns((Profile?)null);

        var result = await _sut.ExecuteAsync("ghost", new UpdateProfileRequest("X", "other", "notify"));

        Assert.Null(result);
        await _repo.DidNotReceive().UpdateAsync(Arg.Any<Profile>(), Arg.Any<CancellationToken>());
    }
}
