using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vyzio.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddRecordingRetention : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "continuous_days_override",
                table: "cameras",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "event_clip_days_override",
                table: "cameras",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "motion_days_override",
                table: "cameras",
                type: "INTEGER",
                nullable: true);

            // Carry the user's intention across before the old column goes (ADR-39). A camera whose
            // box was ticked asked for continuous recording and gets a real window, so the setting
            // finally does something; a camera whose box was not ticked keeps NULL and follows the
            // installation. Written before the drop, otherwise the intention is simply lost.
            migrationBuilder.Sql("""
                UPDATE cameras
                SET continuous_days_override = 7
                WHERE continuous_recording_enabled = 1;
                """);

            migrationBuilder.DropColumn(
                name: "continuous_recording_enabled",
                table: "cameras");

            migrationBuilder.CreateTable(
                name: "recording_settings",
                columns: table => new
                {
                    id = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    continuous_days = table.Column<int>(type: "INTEGER", nullable: false),
                    motion_days = table.Column<int>(type: "INTEGER", nullable: false),
                    event_clip_days = table.Column<int>(type: "INTEGER", nullable: false),
                    updated_at = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_recording_settings", x => x.id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "recording_settings");

            migrationBuilder.AddColumn<bool>(
                name: "continuous_recording_enabled",
                table: "cameras",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            // Symmetric with Up: any camera keeping continuous footage had the box ticked.
            migrationBuilder.Sql("""
                UPDATE cameras
                SET continuous_recording_enabled = 1
                WHERE continuous_days_override > 0;
                """);

            migrationBuilder.DropColumn(
                name: "continuous_days_override",
                table: "cameras");

            migrationBuilder.DropColumn(
                name: "event_clip_days_override",
                table: "cameras");

            migrationBuilder.DropColumn(
                name: "motion_days_override",
                table: "cameras");
        }
    }
}
