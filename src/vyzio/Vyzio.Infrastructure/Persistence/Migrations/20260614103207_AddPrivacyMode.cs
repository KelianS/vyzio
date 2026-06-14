using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vyzio.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPrivacyMode : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "privacy_mode_active",
                table: "cameras",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "privacy_mode_source",
                table: "cameras",
                type: "TEXT",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "privacy_vendor_cut",
                table: "cameras",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "camera_privacy_schedules",
                columns: table => new
                {
                    id = table.Column<string>(type: "TEXT", nullable: false),
                    camera_id = table.Column<string>(type: "TEXT", nullable: false),
                    enabled = table.Column<bool>(type: "INTEGER", nullable: false),
                    days_of_week = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    start_time = table.Column<string>(type: "TEXT", maxLength: 5, nullable: false),
                    end_time = table.Column<string>(type: "TEXT", maxLength: 5, nullable: false),
                    created_at = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_camera_privacy_schedules", x => x.id);
                    table.ForeignKey(
                        name: "fk_camera_privacy_schedules_cameras_camera_id",
                        column: x => x.camera_id,
                        principalTable: "cameras",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "idx_privacy_schedules_camera",
                table: "camera_privacy_schedules",
                columns: new[] { "camera_id", "enabled" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "camera_privacy_schedules");

            migrationBuilder.DropColumn(
                name: "privacy_mode_active",
                table: "cameras");

            migrationBuilder.DropColumn(
                name: "privacy_mode_source",
                table: "cameras");

            migrationBuilder.DropColumn(
                name: "privacy_vendor_cut",
                table: "cameras");
        }
    }
}
