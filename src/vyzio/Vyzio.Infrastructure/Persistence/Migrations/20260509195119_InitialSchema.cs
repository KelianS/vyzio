using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vyzio.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "notifications",
                columns: table => new
                {
                    id = table.Column<string>(type: "TEXT", nullable: false),
                    event_id = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    channel = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    status = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    sent_at = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                    error_message = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_notifications", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "profiles",
                columns: table => new
                {
                    id = table.Column<string>(type: "TEXT", nullable: false),
                    name = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    category = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    alert_mode = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    last_seen_at = table.Column<DateTimeOffset>(type: "TEXT", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_profiles", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "sessions",
                columns: table => new
                {
                    id = table.Column<string>(type: "TEXT", nullable: false),
                    user_id = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                    expires_at = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                    revoked = table.Column<bool>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_sessions", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "settings",
                columns: table => new
                {
                    key = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    value = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_settings", x => x.key);
                });

            migrationBuilder.CreateTable(
                name: "recognition_events",
                columns: table => new
                {
                    id = table.Column<string>(type: "TEXT", nullable: false),
                    frigate_event_id = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    camera_name = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    recognition_type = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    profile_id = table.Column<string>(type: "TEXT", maxLength: 100, nullable: true),
                    profile_name = table.Column<string>(type: "TEXT", maxLength: 200, nullable: true),
                    confidence = table.Column<float>(type: "REAL", nullable: true),
                    thumbnail_jpeg = table.Column<byte[]>(type: "BLOB", nullable: true),
                    occurred_at = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                    notified = table.Column<bool>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_recognition_events", x => x.id);
                    table.ForeignKey(
                        name: "fk_recognition_events_profiles_profile_id",
                        column: x => x.profile_id,
                        principalTable: "profiles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "idx_events_occurred",
                table: "recognition_events",
                column: "occurred_at");

            migrationBuilder.CreateIndex(
                name: "idx_events_profile",
                table: "recognition_events",
                columns: new[] { "profile_id", "occurred_at" });

            migrationBuilder.CreateIndex(
                name: "ux_events_frigate_event_id",
                table: "recognition_events",
                column: "frigate_event_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "notifications");

            migrationBuilder.DropTable(
                name: "recognition_events");

            migrationBuilder.DropTable(
                name: "sessions");

            migrationBuilder.DropTable(
                name: "settings");

            migrationBuilder.DropTable(
                name: "profiles");
        }
    }
}
