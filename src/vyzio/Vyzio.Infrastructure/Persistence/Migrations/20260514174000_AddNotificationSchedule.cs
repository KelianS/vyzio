using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vyzio.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddNotificationSchedule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "active_from_hour",
                table: "notification_channel_configs",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "active_to_hour",
                table: "notification_channel_configs",
                type: "INTEGER",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "active_from_hour",
                table: "notification_channel_configs");

            migrationBuilder.DropColumn(
                name: "active_to_hour",
                table: "notification_channel_configs");
        }
    }
}
