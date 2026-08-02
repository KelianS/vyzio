using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Vyzio.Core.Entities;
using Vyzio.Infrastructure.Persistence.Conversions;

namespace Vyzio.Infrastructure.Persistence;

public class VyzioDbContext(DbContextOptions<VyzioDbContext> options) : DbContext(options)
{
    public DbSet<Camera> Cameras => Set<Camera>();
    public DbSet<CameraPrivacySchedule> CameraPrivacySchedules => Set<CameraPrivacySchedule>();
    public DbSet<CameraCapabilityBinding> CameraCapabilityBindings => Set<CameraCapabilityBinding>();
    public DbSet<CameraStream> CameraStreams => Set<CameraStream>();
    public DbSet<PtzPreset> PtzPresets => Set<PtzPreset>();
    public DbSet<Profile> Profiles => Set<Profile>();
    public DbSet<ProfilePhoto> ProfilePhotos => Set<ProfilePhoto>();
    public DbSet<ProfileCameraLink> ProfileCameraLinks => Set<ProfileCameraLink>();
    public DbSet<DetectionEvent> DetectionEvents => Set<DetectionEvent>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<Session> Sessions => Set<Session>();
    public DbSet<NotificationChannelConfig> NotificationChannelConfigs => Set<NotificationChannelConfig>();
    public DbSet<RecordingSettings> RecordingSettings => Set<RecordingSettings>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        ConfigureSqliteDateTimeOffsets(modelBuilder);

        modelBuilder.Entity<CameraPrivacySchedule>(schedule =>
        {
            schedule.HasOne(s => s.Camera)
                    .WithMany()
                    .HasForeignKey(s => s.CameraId)
                    .OnDelete(DeleteBehavior.Cascade);

            schedule.HasIndex(s => new { s.CameraId, s.Enabled })
                    .HasDatabaseName("idx_privacy_schedules_camera");
        });

        modelBuilder.Entity<Camera>(camera =>
        {
            camera.HasIndex(c => c.Slug)
                .IsUnique()
                .HasDatabaseName("ux_cameras_slug");

            camera.HasIndex(c => c.DisplayName)
                .HasDatabaseName("idx_cameras_display_name");

            camera.HasIndex(c => c.Status)
                .HasDatabaseName("idx_cameras_status");

            // ADR-22 point 0 — enum in code, same TEXT column/values already in the database.
            camera.Property(c => c.StreamProtocol).HasConversion<SnakeCaseEnumConverter<StreamProtocol>>();
            camera.Property(c => c.VendorFamily).HasConversion<NullableSnakeCaseEnumConverter<VendorFamily>>();
            camera.Property(c => c.PrivacyModeSource).HasConversion<NullableSnakeCaseEnumConverter<PrivacyModeSource>>();
            camera.Property(c => c.PrivacyStrategy).HasConversion<SnakeCaseEnumConverter<PrivacyStrategy>>();

            camera.HasIndex(c => c.DeviceId)
                .HasDatabaseName("idx_cameras_device");
        });

        modelBuilder.Entity<CameraStream>(stream =>
        {
            stream.HasOne(s => s.Camera)
                  .WithMany(c => c.Streams)
                  .HasForeignKey(s => s.CameraId)
                  .OnDelete(DeleteBehavior.Cascade);

            // One row per rank — ranks are dense and start at 0 (ADR-38).
            stream.HasIndex(s => new { s.CameraId, s.Ordinal })
                  .IsUnique()
                  .HasDatabaseName("ux_camera_streams_camera_ordinal");

            stream.Ignore(s => s.HasKnownResolution);
        });

        modelBuilder.Entity<CameraCapabilityBinding>(binding =>
        {
            binding.HasOne(b => b.Camera)
                   .WithMany()
                   .HasForeignKey(b => b.CameraId)
                   .OnDelete(DeleteBehavior.Cascade);

            binding.HasIndex(b => new { b.CameraId, b.Capability })
                   .IsUnique()
                   .HasDatabaseName("ux_capability_bindings_camera_capability");

            binding.Property(b => b.Capability).HasConversion<SnakeCaseEnumConverter<CameraCapability>>();
            binding.Property(b => b.Protocol).HasConversion<SnakeCaseEnumConverter<SupportedProtocol>>();
        });

        modelBuilder.Entity<PtzPreset>(preset =>
        {
            preset.HasIndex(p => new { p.CameraId, p.PresetId })
                  .IsUnique()
                  .HasDatabaseName("ux_ptz_presets_camera_preset");
        });

        modelBuilder.Entity<ProfilePhoto>(photo =>
        {
            photo.HasOne(p => p.Profile)
                 .WithMany(pr => pr.Photos)
                 .HasForeignKey(p => p.ProfileId)
                 .OnDelete(DeleteBehavior.Cascade);

            photo.HasIndex(p => p.ProfileId)
                 .HasDatabaseName("idx_photos_profile");
        });

        modelBuilder.Entity<ProfileCameraLink>(link =>
        {
            link.HasOne(l => l.Profile)
                .WithMany(p => p.CameraLinks)
                .HasForeignKey(l => l.ProfileId)
                .OnDelete(DeleteBehavior.Cascade);

            link.HasOne(l => l.Camera)
                .WithMany()
                .HasForeignKey(l => l.CameraId)
                .OnDelete(DeleteBehavior.Cascade);

            link.HasIndex(l => new { l.ProfileId, l.CameraId })
                .IsUnique()
                .HasDatabaseName("ux_pcl_profile_camera");

            link.HasIndex(l => new { l.CameraId, l.Enabled })
                .HasDatabaseName("idx_pcl_camera");

            link.HasIndex(l => new { l.ProfileId, l.Enabled })
                .HasDatabaseName("idx_pcl_profile");
        });

        modelBuilder.Entity<DetectionEvent>(e =>
        {
            e.HasOne(ev => ev.Profile)
             .WithMany(p => p.DetectionEvents)
             .HasForeignKey(ev => ev.ProfileId)
             .OnDelete(DeleteBehavior.Cascade);

            e.HasIndex(ev => ev.OccurredAt)
             .HasDatabaseName("idx_events_occurred");
            e.HasIndex(ev => new { ev.ProfileId, ev.OccurredAt })
             .HasDatabaseName("idx_events_profile");
            e.HasIndex(ev => new { ev.Camera, ev.OccurredAt })
             .HasDatabaseName("idx_events_camera");
            e.HasIndex(ev => new { ev.Label, ev.OccurredAt })
             .HasDatabaseName("idx_events_label");
            e.HasIndex(ev => ev.FrigateEventId)
             .IsUnique()
             .HasDatabaseName("ux_events_frigate_event_id");
        });
    }

    private void ConfigureSqliteDateTimeOffsets(ModelBuilder modelBuilder)
    {
        if (!Database.IsSqlite())
        {
            return;
        }

        var dateTimeOffsetConverter = new ValueConverter<DateTimeOffset, DateTime>(
            value => value.UtcDateTime,
            value => new DateTimeOffset(DateTime.SpecifyKind(value, DateTimeKind.Utc)));

        var nullableDateTimeOffsetConverter = new ValueConverter<DateTimeOffset?, DateTime?>(
            value => value.HasValue ? value.Value.UtcDateTime : null,
            value => value.HasValue
                ? new DateTimeOffset(DateTime.SpecifyKind(value.Value, DateTimeKind.Utc))
                : null);

        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            foreach (var property in entityType.GetProperties())
            {
                if (property.ClrType == typeof(DateTimeOffset))
                {
                    property.SetValueConverter(dateTimeOffsetConverter);
                }
                else if (property.ClrType == typeof(DateTimeOffset?))
                {
                    property.SetValueConverter(nullableDateTimeOffsetConverter);
                }
            }
        }
    }
}
