using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vyzio.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDetectionProfileFeatures : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "detection_preset",
                table: "cameras");

            migrationBuilder.AddColumn<string>(
                name: "detection_labels_json",
                table: "cameras",
                type: "TEXT",
                maxLength: 500,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "profile_camera_links",
                columns: table => new
                {
                    id = table.Column<string>(type: "TEXT", nullable: false),
                    profile_id = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    camera_id = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    enabled = table.Column<bool>(type: "INTEGER", nullable: false),
                    created_at = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_profile_camera_links", x => x.id);
                    table.ForeignKey(
                        name: "fk_profile_camera_links_cameras_camera_id",
                        column: x => x.camera_id,
                        principalTable: "cameras",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_profile_camera_links_profiles_profile_id",
                        column: x => x.profile_id,
                        principalTable: "profiles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "profile_photos",
                columns: table => new
                {
                    id = table.Column<string>(type: "TEXT", nullable: false),
                    profile_id = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    filename = table.Column<string>(type: "TEXT", maxLength: 300, nullable: false),
                    frigate_synced = table.Column<bool>(type: "INTEGER", nullable: false),
                    synced_at = table.Column<DateTime>(type: "TEXT", nullable: true),
                    created_at = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_profile_photos", x => x.id);
                    table.ForeignKey(
                        name: "fk_profile_photos_profiles_profile_id",
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
                name: "idx_pcl_camera",
                table: "profile_camera_links",
                columns: new[] { "camera_id", "enabled" });

            migrationBuilder.CreateIndex(
                name: "idx_pcl_profile",
                table: "profile_camera_links",
                columns: new[] { "profile_id", "enabled" });

            migrationBuilder.CreateIndex(
                name: "ux_pcl_profile_camera",
                table: "profile_camera_links",
                columns: new[] { "profile_id", "camera_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_photos_profile",
                table: "profile_photos",
                column: "profile_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "profile_camera_links");

            migrationBuilder.DropTable(
                name: "profile_photos");

            migrationBuilder.DropIndex(
                name: "idx_events_camera",
                table: "observed_events");

            migrationBuilder.DropIndex(
                name: "idx_events_label",
                table: "observed_events");

            migrationBuilder.DropColumn(
                name: "detection_labels_json",
                table: "cameras");

            migrationBuilder.AddColumn<string>(
                name: "detection_preset",
                table: "cameras",
                type: "TEXT",
                maxLength: 50,
                nullable: false,
                defaultValue: "");
        }
    }
}
