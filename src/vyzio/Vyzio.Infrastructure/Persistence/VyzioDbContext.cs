using Microsoft.EntityFrameworkCore;
using Vyzio.Core.Entities;

namespace Vyzio.Infrastructure.Persistence;

public class VyzioDbContext(DbContextOptions<VyzioDbContext> options) : DbContext(options)
{
    public DbSet<Profile> Profiles => Set<Profile>();
    public DbSet<RecognitionEvent> RecognitionEvents => Set<RecognitionEvent>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<Session> Sessions => Set<Session>();
    public DbSet<Setting> Settings => Set<Setting>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<RecognitionEvent>(e =>
        {
            e.HasOne(ev => ev.Profile)
             .WithMany(p => p.RecognitionEvents)
             .HasForeignKey(ev => ev.ProfileId)
             .OnDelete(DeleteBehavior.Cascade);

            e.HasIndex(ev => ev.OccurredAt)
             .HasDatabaseName("idx_events_occurred");
            e.HasIndex(ev => new { ev.ProfileId, ev.OccurredAt })
             .HasDatabaseName("idx_events_profile");
            e.HasIndex(ev => ev.FrigateEventId)
             .IsUnique()
             .HasDatabaseName("ux_events_frigate_event_id");
        });
    }
}
