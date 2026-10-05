using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vyzio.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class NativePresetsLiveInTheCamera : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "native",
                table: "ptz_presets");

            migrationBuilder.DropColumn(
                name: "native_token",
                table: "ptz_presets");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "native",
                table: "ptz_presets",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "native_token",
                table: "ptz_presets",
                type: "TEXT",
                nullable: true);
        }
    }
}
