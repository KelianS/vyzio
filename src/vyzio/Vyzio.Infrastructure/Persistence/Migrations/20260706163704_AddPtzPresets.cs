using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vyzio.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPtzPresets : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ptz_presets",
                columns: table => new
                {
                    id = table.Column<string>(type: "TEXT", nullable: false),
                    camera_id = table.Column<string>(type: "TEXT", nullable: false),
                    preset_id = table.Column<int>(type: "INTEGER", nullable: false),
                    label = table.Column<string>(type: "TEXT", nullable: false),
                    native = table.Column<bool>(type: "INTEGER", nullable: false),
                    native_token = table.Column<string>(type: "TEXT", nullable: true),
                    steps_x = table.Column<int>(type: "INTEGER", nullable: true),
                    steps_y = table.Column<int>(type: "INTEGER", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_ptz_presets", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ux_ptz_presets_camera_preset",
                table: "ptz_presets",
                columns: new[] { "camera_id", "preset_id" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ptz_presets");
        }
    }
}
