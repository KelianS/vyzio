using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vyzio.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class DropObservedEvents : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "observed_events");

            migrationBuilder.RenameColumn(
                name: "event_id",
                table: "notifications",
                newName: "frigate_event_id");

            migrationBuilder.AddColumn<string>(
                name: "camera",
                table: "notifications",
                type: "TEXT",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "label",
                table: "notifications",
                type: "TEXT",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "idx_notifications_cooldown",
                table: "notifications",
                columns: new[] { "channel", "camera", "label", "sent_at" });

            migrationBuilder.CreateIndex(
                name: "idx_notifications_event",
                table: "notifications",
                columns: new[] { "frigate_event_id", "channel" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "idx_notifications_cooldown",
                table: "notifications");

            migrationBuilder.DropIndex(
                name: "idx_notifications_event",
                table: "notifications");

            migrationBuilder.DropColumn(
                name: "camera",
                table: "notifications");

            migrationBuilder.DropColumn(
                name: "label",
                table: "notifications");

            migrationBuilder.RenameColumn(
                name: "frigate_event_id",
                table: "notifications",
                newName: "event_id");

            migrationBuilder.CreateTable(
                name: "observed_events",
                columns: table => new
                {
                    id = table.Column<string>(type: "TEXT", nullable: false),
                    profile_id = table.Column<string>(type: "TEXT", maxLength: 100, nullable: true),
                    camera = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    confidence = table.Column<float>(type: "REAL", nullable: true),
                    frigate_event_id = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    has_clip = table.Column<bool>(type: "INTEGER", nullable: false),
                    has_snapshot = table.Column<bool>(type: "INTEGER", nullable: false),
                    identity = table.Column<string>(type: "TEXT", maxLength: 200, nullable: true),
                    label = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    lifecycle = table.Column<string>(type: "TEXT", maxLength: 20, nullable: false),
                    occurred_at = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_observed_events", x => x.id);
                    table.ForeignKey(
                        name: "fk_observed_events_profiles_profile_id",
                        column: x => x.profile_id,
                        principalTable: "profiles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "idx_events_camera",
                table: "observed_events",
                columns: new[] { "camera", "occurred_at" });

            migrationBuilder.CreateIndex(
                name: "idx_events_label",
                table: "observed_events",
                columns: new[] { "label", "occurred_at" });

            migrationBuilder.CreateIndex(
                name: "idx_events_occurred",
                table: "observed_events",
                column: "occurred_at");

            migrationBuilder.CreateIndex(
                name: "idx_events_profile",
                table: "observed_events",
                columns: new[] { "profile_id", "occurred_at" });

            migrationBuilder.CreateIndex(
                name: "ux_events_frigate_event_id",
                table: "observed_events",
                column: "frigate_event_id",
                unique: true);
        }
    }
}
