using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vyzio.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddContinuousRecording : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "continuous_recording_enabled",
                table: "cameras",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "continuous_recording_enabled",
                table: "cameras");
        }
    }
}
