using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vyzio.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddNotificationChannelConfig : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "notification_channel_configs",
                columns: table => new
                {
                    id = table.Column<string>(type: "TEXT", nullable: false),
                    channel = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    is_enabled = table.Column<bool>(type: "INTEGER", nullable: false),
                    bot_token = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true),
                    chat_id = table.Column<string>(type: "TEXT", maxLength: 100, nullable: true),
                    minimum_confidence = table.Column<float>(type: "REAL", nullable: false),
                    allowed_labels_json = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true),
                    configured_at = table.Column<DateTime>(type: "TEXT", nullable: true),
                    last_tested_at = table.Column<DateTime>(type: "TEXT", nullable: true),
                    last_test_status = table.Column<string>(type: "TEXT", maxLength: 50, nullable: true),
                    last_test_error = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_notification_channel_configs", x => x.id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "notification_channel_configs");
        }
    }
}
