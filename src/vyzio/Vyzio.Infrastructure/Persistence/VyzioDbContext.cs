using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Vyzio.Core.Entities;

namespace Vyzio.Infrastructure.Persistence;

public class VyzioDbContext(DbContextOptions<VyzioDbContext> options) : DbContext(options)
{
    public DbSet<Camera> Cameras => Set<Camera>();
    public DbSet<CameraPrivacySchedule> CameraPrivacySchedules => Set<CameraPrivacySchedule>();
    public DbSet<Profile> Profiles => Set<Profile>();
    public DbSet<ProfilePhoto> ProfilePhotos => Set<ProfilePhoto>();
    public DbSet<ProfileCameraLink> ProfileCameraLinks => Set<ProfileCameraLink>();
    public DbSet<DetectionEvent> DetectionEvents => Set<DetectionEvent>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<Session> Sessions => Set<Session>();
    public DbSet<NotificationChannelConfig> NotificationChannelConfigs => Set<NotificationChannelConfig>();

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
