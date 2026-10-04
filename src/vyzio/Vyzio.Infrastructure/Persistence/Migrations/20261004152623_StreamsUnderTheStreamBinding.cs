using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vyzio.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class StreamsUnderTheStreamBinding : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "camera_streams",
                columns: table => new
                {
                    id = table.Column<string>(type: "TEXT", nullable: false),
                    binding_id = table.Column<string>(type: "TEXT", nullable: false),
                    ordinal = table.Column<int>(type: "INTEGER", nullable: false),
                    protocol = table.Column<string>(type: "TEXT", nullable: false),
                    path = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true),
                    width = table.Column<int>(type: "INTEGER", nullable: true),
                    height = table.Column<int>(type: "INTEGER", nullable: true),
                    fps = table.Column<int>(type: "INTEGER", nullable: true),
                    role = table.Column<string>(type: "TEXT", nullable: false),
                    verified = table.Column<bool>(type: "INTEGER", nullable: false),
                    checked_at = table.Column<DateTime>(type: "TEXT", nullable: true),
                    last_error = table.Column<string>(type: "TEXT", nullable: true),
                    created_at = table.Column<DateTime>(type: "TEXT", nullable: false),
                    updated_at = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_camera_streams", x => x.id);
                    table.ForeignKey(
                        name: "fk_camera_streams_camera_capability_bindings_binding_id",
                        column: x => x.binding_id,
                        principalTable: "camera_capability_bindings",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ux_camera_streams_binding_ordinal",
                table: "camera_streams",
                columns: new[] { "binding_id", "ordinal" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "camera_streams");
        }
    }
}
