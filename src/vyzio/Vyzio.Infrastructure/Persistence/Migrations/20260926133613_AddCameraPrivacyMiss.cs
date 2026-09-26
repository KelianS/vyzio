using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vyzio.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCameraPrivacyMiss : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "privacy_miss",
                table: "cameras",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "privacy_miss_detail",
                table: "cameras",
                type: "TEXT",
                maxLength: 500,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "privacy_miss",
                table: "cameras");

            migrationBuilder.DropColumn(
                name: "privacy_miss_detail",
                table: "cameras");
        }
    }
}
