using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vyzio.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddMediaMode : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "media_mode",
                table: "notification_channel_configs",
                type: "TEXT",
                maxLength: 20,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "media_mode",
                table: "notification_channel_configs");
        }
    }
}
