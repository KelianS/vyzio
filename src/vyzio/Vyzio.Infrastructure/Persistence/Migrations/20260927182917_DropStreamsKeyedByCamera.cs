using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vyzio.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class DropStreamsKeyedByCamera : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "camera_streams");

            migrationBuilder.DropColumn(
                name: "detect_stream_id",
                table: "cameras");

            migrationBuilder.AddColumn<DateTime>(
                name: "streams_found_at",
                table: "camera_capability_bindings",
                type: "TEXT",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "streams_found_at",
                table: "camera_capability_bindings");

            migrationBuilder.AddColumn<string>(
                name: "detect_stream_id",
                table: "cameras",
                type: "TEXT",
                maxLength: 100,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "camera_streams",
                columns: table => new
                {
                    id = table.Column<string>(type: "TEXT", nullable: false),
                    camera_id = table.Column<string>(type: "TEXT", nullable: false),
                    created_at = table.Column<DateTime>(type: "TEXT", nullable: false),
                    fps = table.Column<int>(type: "INTEGER", nullable: true),
                    height = table.Column<int>(type: "INTEGER", nullable: true),
                    ordinal = table.Column<int>(type: "INTEGER", nullable: false),
                    path = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true),
                    updated_at = table.Column<DateTime>(type: "TEXT", nullable: false),
                    width = table.Column<int>(type: "INTEGER", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_camera_streams", x => x.id);
                    table.ForeignKey(
                        name: "fk_camera_streams_cameras_camera_id",
                        column: x => x.camera_id,
                        principalTable: "cameras",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ux_camera_streams_camera_ordinal",
                table: "camera_streams",
                columns: new[] { "camera_id", "ordinal" },
                unique: true);
        }
    }
}
