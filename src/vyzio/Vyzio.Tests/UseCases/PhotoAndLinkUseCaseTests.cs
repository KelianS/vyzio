using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Vyzio.Application.DTOs.DetectionEvents;
using Vyzio.Application.DTOs.Profiles;
using Vyzio.Application.Options;
using Vyzio.Application.UseCases.DetectionEvents;
using Vyzio.Application.UseCases.Profiles;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Tests.UseCases;

public class AddProfilePhotoUseCaseTests
{
    private readonly IProfileRepository _profiles = Substitute.For<IProfileRepository>();
    private readonly IProfilePhotoRepository _photos = Substitute.For<IProfilePhotoRepository>();
    private readonly IFrigateFaceLibrary _faceLibrary = Substitute.For<IFrigateFaceLibrary>();

    private AddProfilePhotoUseCase CreateSut(string dataDir)
        => new(_profiles, _photos, _faceLibrary, new FaceStorageOptions(dataDir),
            NullLogger<AddProfilePhotoUseCase>.Instance);

    [Fact]
    public async Task ExecuteAsync_throws_when_profile_not_found()
    {
        _profiles.GetByIdAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns((Profile?)null);
        var sut = CreateSut(Path.GetTempPath());

        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            sut.ExecuteAsync("missing-id", "photo.jpg", [0x01, 0x02]));
    }

    [Fact]
    public async Task ExecuteAsync_throws_when_image_empty()
    {
        var profile = new Profile { Name = "Alice" };
        _profiles.GetByIdAsync(profile.Id, Arg.Any<CancellationToken>()).Returns(profile);
        var sut = CreateSut(Path.GetTempPath());

        await Assert.ThrowsAsync<ArgumentException>(() =>
            sut.ExecuteAsync(profile.Id, "photo.jpg", []));
    }

    [Fact]
    public async Task ExecuteAsync_writes_file_and_adds_db_record()
    {
        var profile = new Profile { Name = "Bob" };
        _profiles.GetByIdAsync(profile.Id, Arg.Any<CancellationToken>()).Returns(profile);

        var tempDir = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString("N"));
        var sut = CreateSut(tempDir);

        var dto = await sut.ExecuteAsync(profile.Id, "test.jpg", new byte[] { 0xFF, 0xD8, 0xFF });

        await _photos.Received(1).AddAsync(Arg.Is<ProfilePhoto>(p => p.ProfileId == profile.Id), Arg.Any<CancellationToken>());
        Assert.Equal(profile.Id, dto.ProfileId);
        Assert.NotEmpty(dto.Filename);

        // Cleanup
        var facesDir = Path.Combine(tempDir, "faces", profile.Id);
        if (Directory.Exists(facesDir)) Directory.Delete(facesDir, recursive: true);
    }

    [Fact]
    public async Task ExecuteAsync_syncs_to_frigate_and_marks_synced()
    {
        var profile = new Profile { Name = "Carol" };
        _profiles.GetByIdAsync(profile.Id, Arg.Any<CancellationToken>()).Returns(profile);

        var tempDir = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString("N"));
        var sut = CreateSut(tempDir);
        var bytes = new byte[] { 0x01, 0x02, 0x03 };

        var dto = await sut.ExecuteAsync(profile.Id, "photo.jpg", bytes);

        await _faceLibrary.Received(1).UploadFacePhotoAsync(
            "Carol", Arg.Any<string>(), bytes, Arg.Any<CancellationToken>());
        Assert.True(dto.FrigateSynced);

        var facesDir = Path.Combine(tempDir, "faces", profile.Id);
        if (Directory.Exists(facesDir)) Directory.Delete(facesDir, recursive: true);
    }

    [Fact]
    public async Task ExecuteAsync_does_not_fail_when_frigate_sync_throws()
    {
        var profile = new Profile { Name = "Dave" };
        _profiles.GetByIdAsync(profile.Id, Arg.Any<CancellationToken>()).Returns(profile);
        _faceLibrary.UploadFacePhotoAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<byte[]>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromException(new HttpRequestException("Frigate down")));

        var tempDir = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString("N"));
        var sut = CreateSut(tempDir);

        var dto = await sut.ExecuteAsync(profile.Id, "photo.jpg", [0x01]);

        Assert.False(dto.FrigateSynced);

        var facesDir = Path.Combine(tempDir, "faces", profile.Id);
        if (Directory.Exists(facesDir)) Directory.Delete(facesDir, recursive: true);
    }
}

public class RemoveProfilePhotoUseCaseTests
{
    private readonly IProfileRepository _profiles = Substitute.For<IProfileRepository>();
    private readonly IProfilePhotoRepository _photos = Substitute.For<IProfilePhotoRepository>();
    private readonly IFrigateFaceLibrary _faceLibrary = Substitute.For<IFrigateFaceLibrary>();

    private RemoveProfilePhotoUseCase CreateSut()
        => new(_profiles, _photos, _faceLibrary, new FaceStorageOptions(Path.GetTempPath()),
            NullLogger<RemoveProfilePhotoUseCase>.Instance);

    [Fact]
    public async Task ExecuteAsync_returns_false_when_photo_not_found()
    {
        _photos.GetByIdAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns((ProfilePhoto?)null);
        var sut = CreateSut();

        var result = await sut.ExecuteAsync("pid", "photo-id");

        Assert.False(result);
    }

    [Fact]
    public async Task ExecuteAsync_returns_false_when_photo_belongs_to_different_profile()
    {
        var photo = new ProfilePhoto { ProfileId = "other-profile", Filename = "x.jpg" };
        _photos.GetByIdAsync(photo.Id, Arg.Any<CancellationToken>()).Returns(photo);
        var sut = CreateSut();

        var result = await sut.ExecuteAsync("my-profile", photo.Id);

        Assert.False(result);
    }

    [Fact]
    public async Task ExecuteAsync_deletes_db_record_on_success()
    {
        var photo = new ProfilePhoto { ProfileId = "pid", Filename = "x.jpg", FrigateSynced = false };
        _photos.GetByIdAsync(photo.Id, Arg.Any<CancellationToken>()).Returns(photo);
        _profiles.GetByIdAsync("pid", Arg.Any<CancellationToken>()).Returns(new Profile { Name = "Alice" });
        var sut = CreateSut();

        var result = await sut.ExecuteAsync("pid", photo.Id);

        Assert.True(result);
        await _photos.Received(1).DeleteAsync(photo.Id, Arg.Any<CancellationToken>());
    }
}

public class SetCameraProfileLinksUseCaseTests
{
    private readonly IProfileCameraLinkRepository _links = Substitute.For<IProfileCameraLinkRepository>();
    private readonly IProfileRepository _profiles = Substitute.For<IProfileRepository>();
    private readonly SetCameraProfileLinksUseCase _sut;

    public SetCameraProfileLinksUseCaseTests()
        => _sut = new SetCameraProfileLinksUseCase(_links, _profiles);

    [Fact]
    public async Task ExecuteAsync_upserts_only_valid_profiles()
    {
        var p1 = new Profile { Name = "Alice" };
        _profiles.GetAllAsync(Arg.Any<CancellationToken>()).Returns([p1]);
        _links.GetByCameraIdAsync("cam-1", Arg.Any<CancellationToken>()).Returns([]);

        var request = new SetCameraProfileLinksRequest([p1.Id, "invalid-id"]);

        await _sut.ExecuteAsync("cam-1", request);

        await _links.Received(1).UpsertAsync(
            Arg.Is<ProfileCameraLink>(l => l.ProfileId == p1.Id && l.CameraId == "cam-1"),
            Arg.Any<CancellationToken>());
        await _links.DidNotReceive().UpsertAsync(
            Arg.Is<ProfileCameraLink>(l => l.ProfileId == "invalid-id"),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_removes_links_not_in_request()
    {
        var p1 = new Profile { Name = "Alice" };
        var existingLink = new ProfileCameraLink { ProfileId = "old-profile", CameraId = "cam-1", Enabled = true };
        _profiles.GetAllAsync(Arg.Any<CancellationToken>()).Returns([p1]);
        _links.GetByCameraIdAsync("cam-1", Arg.Any<CancellationToken>()).Returns([existingLink]);

        var request = new SetCameraProfileLinksRequest([p1.Id]);

        await _sut.ExecuteAsync("cam-1", request);

        await _links.Received(1).DeleteByProfileAndCameraAsync("old-profile", "cam-1", Arg.Any<CancellationToken>());
    }
}

public class CorrectDetectionIdentityUseCaseTests
{
    private readonly IDetectionEventRepository _events = Substitute.For<IDetectionEventRepository>();
    private readonly IProfileRepository _profiles = Substitute.For<IProfileRepository>();
    private readonly CorrectDetectionIdentityUseCase _sut;

    public CorrectDetectionIdentityUseCaseTests()
        => _sut = new(_events, _profiles);

    [Fact]
    public async Task ExecuteAsync_returns_false_when_event_not_found()
    {
        _events.GetByFrigateEventIdAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns((DetectionEvent?)null);

        var result = await _sut.ExecuteAsync("missing", new CorrectDetectionIdentityRequest("pid"));

        Assert.False(result);
    }

    [Fact]
    public async Task ExecuteAsync_clears_identity_when_profileId_is_null()
    {
        var evt = new DetectionEvent { FrigateEventId = "x", Lifecycle = "end", Camera = "c", Label = "person" };
        _events.GetByFrigateEventIdAsync(evt.FrigateEventId, Arg.Any<CancellationToken>()).Returns(evt);

        var result = await _sut.ExecuteAsync(evt.FrigateEventId, new CorrectDetectionIdentityRequest(null));

        Assert.True(result);
        await _events.Received(1).UpdateIdentityAsync(evt.Id, null, null, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_sets_identity_from_profile_name()
    {
        var evt = new DetectionEvent { FrigateEventId = "x", Lifecycle = "end", Camera = "c", Label = "person" };
        var profile = new Profile { Name = "Alice" };
        _events.GetByFrigateEventIdAsync(evt.FrigateEventId, Arg.Any<CancellationToken>()).Returns(evt);
        _profiles.GetByIdAsync(profile.Id, Arg.Any<CancellationToken>()).Returns(profile);

        var result = await _sut.ExecuteAsync(evt.FrigateEventId, new CorrectDetectionIdentityRequest(profile.Id));

        Assert.True(result);
        await _events.Received(1).UpdateIdentityAsync(evt.Id, "Alice", profile.Id, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_returns_false_when_profile_not_found()
    {
        var evt = new DetectionEvent { FrigateEventId = "x", Lifecycle = "end", Camera = "c", Label = "person" };
        _events.GetByFrigateEventIdAsync(evt.FrigateEventId, Arg.Any<CancellationToken>()).Returns(evt);
        _profiles.GetByIdAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns((Profile?)null);

        var result = await _sut.ExecuteAsync(evt.FrigateEventId, new CorrectDetectionIdentityRequest("bad-pid"));

        Assert.False(result);
    }
}
