using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vyzio.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCameraStreams : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "detect_stream_id",
                table: "cameras",
                type: "TEXT",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "device_id",
                table: "cameras",
                type: "TEXT",
                maxLength: 200,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "camera_streams",
                columns: table => new
                {
                    id = table.Column<string>(type: "TEXT", nullable: false),
                    camera_id = table.Column<string>(type: "TEXT", nullable: false),
                    ordinal = table.Column<int>(type: "INTEGER", nullable: false),
                    path = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true),
                    width = table.Column<int>(type: "INTEGER", nullable: true),
                    height = table.Column<int>(type: "INTEGER", nullable: true),
                    fps = table.Column<int>(type: "INTEGER", nullable: true),
                    created_at = table.Column<DateTime>(type: "TEXT", nullable: false),
                    updated_at = table.Column<DateTime>(type: "TEXT", nullable: false)
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
                name: "idx_cameras_device",
                table: "cameras",
                column: "device_id");

            migrationBuilder.CreateIndex(
                name: "ux_camera_streams_camera_ordinal",
                table: "camera_streams",
                columns: new[] { "camera_id", "ordinal" },
                unique: true);

            // Every existing camera keeps its address: it becomes that camera's rank 0 (ADR-38).
            // Runs before the column is dropped, otherwise the addresses would be lost.
            migrationBuilder.Sql("""
                INSERT INTO camera_streams (id, camera_id, ordinal, path, created_at, updated_at)
                SELECT lower(hex(randomblob(16))), id, 0, stream_path, datetime('now'), datetime('now')
                FROM cameras;
                """);

            migrationBuilder.DropColumn(
                name: "stream_path",
                table: "cameras");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "stream_path",
                table: "cameras",
                type: "TEXT",
                maxLength: 500,
                nullable: true);

            migrationBuilder.Sql("""
                UPDATE cameras
                SET stream_path = (
                    SELECT path FROM camera_streams
                    WHERE camera_streams.camera_id = cameras.id AND camera_streams.ordinal = 0
                );
                """);

            migrationBuilder.DropTable(
                name: "camera_streams");

            migrationBuilder.DropIndex(
                name: "idx_cameras_device",
                table: "cameras");

            migrationBuilder.DropColumn(
                name: "detect_stream_id",
                table: "cameras");

            migrationBuilder.DropColumn(
                name: "device_id",
                table: "cameras");
        }
    }
}
