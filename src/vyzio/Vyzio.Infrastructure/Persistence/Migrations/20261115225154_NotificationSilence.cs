using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vyzio.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class NotificationSilence : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "is_enabled",
                table: "notification_channel_configs");

            migrationBuilder.CreateTable(
                name: "notification_silence",
                columns: table => new
                {
                    id = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    started_at = table.Column<DateTime>(type: "TEXT", nullable: false),
                    until = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_notification_silence", x => x.id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "notification_silence");

            migrationBuilder.AddColumn<bool>(
                name: "is_enabled",
                table: "notification_channel_configs",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);
        }
    }
}
