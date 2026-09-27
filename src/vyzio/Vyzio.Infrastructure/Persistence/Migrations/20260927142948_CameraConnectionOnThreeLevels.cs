using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vyzio.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class CameraConnectionOnThreeLevels : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "port",
                table: "cameras");

            migrationBuilder.DropColumn(
                name: "protocol_endpoints_json",
                table: "cameras");

            migrationBuilder.DropColumn(
                name: "stream_protocol",
                table: "cameras");

            migrationBuilder.DropColumn(
                name: "supported_protocols_json",
                table: "cameras");

            migrationBuilder.CreateTable(
                name: "camera_protocols",
                columns: table => new
                {
                    id = table.Column<string>(type: "TEXT", nullable: false),
                    camera_id = table.Column<string>(type: "TEXT", nullable: false),
                    protocol = table.Column<string>(type: "TEXT", nullable: false),
                    port = table.Column<int>(type: "INTEGER", nullable: true),
                    endpoint = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true),
                    device_id = table.Column<uint>(type: "INTEGER", nullable: true),
                    username = table.Column<string>(type: "TEXT", maxLength: 200, nullable: true),
                    password = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true),
                    status = table.Column<string>(type: "TEXT", nullable: true),
                    checked_at = table.Column<DateTime>(type: "TEXT", nullable: true),
                    last_error = table.Column<string>(type: "TEXT", maxLength: 1000, nullable: true),
                    created_at = table.Column<DateTime>(type: "TEXT", nullable: false),
                    updated_at = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_camera_protocols", x => x.id);
                    table.ForeignKey(
                        name: "fk_camera_protocols_cameras_camera_id",
                        column: x => x.camera_id,
                        principalTable: "cameras",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ux_camera_protocols_camera_protocol",
                table: "camera_protocols",
                columns: new[] { "camera_id", "protocol" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "camera_protocols");

            migrationBuilder.AddColumn<int>(
                name: "port",
                table: "cameras",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "protocol_endpoints_json",
                table: "cameras",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "stream_protocol",
                table: "cameras",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "supported_protocols_json",
                table: "cameras",
                type: "TEXT",
                nullable: true);
        }
    }
}
