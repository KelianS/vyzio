using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vyzio.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCameraCapabilityBindings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "camera_capability_bindings",
                columns: table => new
                {
                    id = table.Column<string>(type: "TEXT", nullable: false),
                    camera_id = table.Column<string>(type: "TEXT", nullable: false),
                    capability = table.Column<string>(type: "TEXT", nullable: false),
                    protocol = table.Column<string>(type: "TEXT", nullable: false),
                    config_json = table.Column<string>(type: "TEXT", nullable: true),
                    verified = table.Column<bool>(type: "INTEGER", nullable: false),
                    verified_at = table.Column<DateTime>(type: "TEXT", nullable: true),
                    last_error = table.Column<string>(type: "TEXT", nullable: true),
                    created_at = table.Column<DateTime>(type: "TEXT", nullable: false),
                    updated_at = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_camera_capability_bindings", x => x.id);
                    table.ForeignKey(
                        name: "fk_camera_capability_bindings_cameras_camera_id",
                        column: x => x.camera_id,
                        principalTable: "cameras",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ux_capability_bindings_camera_capability",
                table: "camera_capability_bindings",
                columns: new[] { "camera_id", "capability" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "camera_capability_bindings");
        }
    }
}
