using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vyzio.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class GenericNotificationChannels : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Credentials moved into their own shape and no row survives it: the channel is
            // reconfigured from the settings screen (ADR-50, no data carry-over before release).
            migrationBuilder.Sql("DELETE FROM notification_channel_configs;");

            migrationBuilder.DropColumn(
                name: "bot_token",
                table: "notification_channel_configs");

            migrationBuilder.DropColumn(
                name: "chat_id",
                table: "notification_channel_configs");

            migrationBuilder.DropColumn(
                name: "last_test_status",
                table: "notification_channel_configs");

            migrationBuilder.AlterColumn<string>(
                name: "media_mode",
                table: "notification_channel_configs",
                type: "TEXT",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "TEXT",
                oldMaxLength: 20,
                oldNullable: true);

            migrationBuilder.AddColumn<string>(
                name: "credentials_json",
                table: "notification_channel_configs",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "last_test_outcome",
                table: "notification_channel_configs",
                type: "TEXT",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ux_notification_channel",
                table: "notification_channel_configs",
                column: "channel",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ux_notification_channel",
                table: "notification_channel_configs");

            migrationBuilder.DropColumn(
                name: "credentials_json",
                table: "notification_channel_configs");

            migrationBuilder.DropColumn(
                name: "last_test_outcome",
                table: "notification_channel_configs");

            migrationBuilder.AlterColumn<string>(
                name: "media_mode",
                table: "notification_channel_configs",
                type: "TEXT",
                maxLength: 20,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "TEXT");

            migrationBuilder.AddColumn<string>(
                name: "bot_token",
                table: "notification_channel_configs",
                type: "TEXT",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "chat_id",
                table: "notification_channel_configs",
                type: "TEXT",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "last_test_status",
                table: "notification_channel_configs",
                type: "TEXT",
                maxLength: 50,
                nullable: true);
        }
    }
}
