using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vyzio.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCameraCatalog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "cameras",
                columns: table => new
                {
                    id = table.Column<string>(type: "TEXT", nullable: false),
                    slug = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    display_name = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    source_type = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    host = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    port = table.Column<int>(type: "INTEGER", nullable: false),
                    username = table.Column<string>(type: "TEXT", maxLength: 200, nullable: true),
                    password = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true),
                    stream_path = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true),
                    detection_preset = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    status = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    last_reachability_check_at = table.Column<DateTime>(type: "TEXT", nullable: true),
                    last_successful_frame_at = table.Column<DateTime>(type: "TEXT", nullable: true),
                    frigate_camera_name = table.Column<string>(type: "TEXT", maxLength: 200, nullable: true),
                    validation_state = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    is_enabled = table.Column<bool>(type: "INTEGER", nullable: false),
                    created_at = table.Column<DateTime>(type: "TEXT", nullable: false),
                    updated_at = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_cameras", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "idx_cameras_display_name",
                table: "cameras",
                column: "display_name");

            migrationBuilder.CreateIndex(
                name: "idx_cameras_status",
                table: "cameras",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ux_cameras_slug",
                table: "cameras",
                column: "slug",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "cameras");
        }
    }
}
