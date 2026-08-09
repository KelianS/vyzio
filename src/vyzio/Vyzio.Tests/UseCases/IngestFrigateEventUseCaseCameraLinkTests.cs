using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Application.UseCases.DetectionEvents;
using Vyzio.Application.UseCases.Frigate;
using Vyzio.Application.UseCases.Notifications;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Tests.UseCases;

// Contract tests for ADR-15: profile-camera link filtering in IngestFrigateEventUseCase
public class IngestFrigateEventUseCaseCameraLinkTests
{
    private readonly IDetectionEventRepository _events = Substitute.For<IDetectionEventRepository>();
    private readonly IDetectionNotificationDispatcher _notifications = Substitute.For<IDetectionNotificationDispatcher>();
    private readonly IFrigateEventReader _eventReader = Substitute.For<IFrigateEventReader>();
    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly IProfileRepository _profiles = Substitute.For<IProfileRepository>();
    private readonly IProfileCameraLinkRepository _links = Substitute.For<IProfileCameraLinkRepository>();

    private IngestFrigateEventUseCase CreateSut()
        => new(
            new FrigateEventContractAdapter(new FrigateLabelFilter(["person"])),
            _events,
            _notifications,
            _eventReader,
            new CameraDirectory(_cameras),
            new DetectionProfileResolver(_profiles, _links),
            NullLogger<IngestFrigateEventUseCase>.Instance);

    private static string PersonPayload(string eventId, string camera = "front_door")
        => $$"""
        {
          "type": "new",
          "after": {
            "id": "{{eventId}}",
            "camera": "{{camera}}",
            "label": "person",
            "top_score": 0.95,
            "sub_label": null,
            "start_time": 1715100000.0,
            "end_time": null,
            "has_clip": true,
            "has_snapshot": true
          }
        }
        """;

    [Fact]
    public async Task ExecuteAsync_resolves_profileId_when_profile_linked_to_camera()
    {
        var profile = new Profile { Name = "Alice" };
        var link = new ProfileCameraLink { ProfileId = profile.Id, CameraId = "front_door", Enabled = true };

        _eventReader.TryGetIdentityAsync("evt-link-1", Arg.Any<CancellationToken>()).Returns("Alice");
        _profiles.GetAllAsync(Arg.Any<CancellationToken>()).Returns([profile]);
        _links.GetByProfileIdAsync(profile.Id, Arg.Any<CancellationToken>()).Returns([link]);

        var sut = CreateSut();
        await sut.ExecuteAsync("frigate/events", PersonPayload("evt-link-1", "front_door"));

        await _events.Received(1).AddAsync(
            Arg.Is<DetectionEvent>(e => e.ProfileId == profile.Id && e.Identity == "Alice"),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ignores_profileId_when_camera_not_in_active_links()
    {
        var profile = new Profile { Name = "Bob" };
        // Link is to garage, not front_door
        var link = new ProfileCameraLink { ProfileId = profile.Id, CameraId = "garage", Enabled = true };

        _eventReader.TryGetIdentityAsync("evt-link-2", Arg.Any<CancellationToken>()).Returns("Bob");
        _profiles.GetAllAsync(Arg.Any<CancellationToken>()).Returns([profile]);
        _links.GetByProfileIdAsync(profile.Id, Arg.Any<CancellationToken>()).Returns([link]);

        var sut = CreateSut();
        await sut.ExecuteAsync("frigate/events", PersonPayload("evt-link-2", "front_door"));

        // Identity is resolved from recognition but ProfileId is null (camera not linked)
        await _events.Received(1).AddAsync(
            Arg.Is<DetectionEvent>(e => e.Identity == "Bob" && e.ProfileId == null),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_resolves_profileId_when_profile_has_no_links()
    {
        // No links = recognize on all cameras (ADR-15)
        var profile = new Profile { Name = "Carol" };

        _eventReader.TryGetIdentityAsync("evt-link-3", Arg.Any<CancellationToken>()).Returns("Carol");
        _profiles.GetAllAsync(Arg.Any<CancellationToken>()).Returns([profile]);
        _links.GetByProfileIdAsync(profile.Id, Arg.Any<CancellationToken>()).Returns([]);

        var sut = CreateSut();
        await sut.ExecuteAsync("frigate/events", PersonPayload("evt-link-3", "any-camera"));

        await _events.Received(1).AddAsync(
            Arg.Is<DetectionEvent>(e => e.ProfileId == profile.Id && e.Identity == "Carol"),
            Arg.Any<CancellationToken>());
    }
}
