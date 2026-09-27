using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vyzio.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RenamePtzPresetStepsToMotionTime : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "steps_y",
                table: "ptz_presets",
                newName: "tilt_ms");

            migrationBuilder.RenameColumn(
                name: "steps_x",
                table: "ptz_presets",
                newName: "pan_ms");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "tilt_ms",
                table: "ptz_presets",
                newName: "steps_y");

            migrationBuilder.RenameColumn(
                name: "pan_ms",
                table: "ptz_presets",
                newName: "steps_x");
        }
    }
}
