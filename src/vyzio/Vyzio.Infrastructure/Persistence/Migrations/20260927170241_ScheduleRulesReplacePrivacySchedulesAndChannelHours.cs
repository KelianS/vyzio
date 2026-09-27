using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vyzio.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ScheduleRulesReplacePrivacySchedulesAndChannelHours : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "camera_privacy_schedules");

            migrationBuilder.DropColumn(
                name: "active_from_hour",
                table: "notification_channel_configs");

            migrationBuilder.DropColumn(
                name: "active_to_hour",
                table: "notification_channel_configs");

            migrationBuilder.CreateTable(
                name: "schedule_rules",
                columns: table => new
                {
                    id = table.Column<string>(type: "TEXT", nullable: false),
                    kind = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    days_of_week = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    start_time = table.Column<string>(type: "TEXT", maxLength: 5, nullable: false),
                    end_time = table.Column<string>(type: "TEXT", maxLength: 5, nullable: false),
                    created_at = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_schedule_rules", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "schedule_rule_targets",
                columns: table => new
                {
                    rule_id = table.Column<string>(type: "TEXT", nullable: false),
                    target_id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_schedule_rule_targets", x => new { x.rule_id, x.target_id });
                    table.ForeignKey(
                        name: "fk_schedule_rule_targets_schedule_rules_rule_id",
                        column: x => x.rule_id,
                        principalTable: "schedule_rules",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "idx_schedule_rules_kind",
                table: "schedule_rules",
                column: "kind");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "schedule_rule_targets");

            migrationBuilder.DropTable(
                name: "schedule_rules");

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

            migrationBuilder.CreateTable(
                name: "camera_privacy_schedules",
                columns: table => new
                {
                    id = table.Column<string>(type: "TEXT", nullable: false),
                    camera_id = table.Column<string>(type: "TEXT", nullable: false),
                    created_at = table.Column<DateTime>(type: "TEXT", nullable: false),
                    days_of_week = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    enabled = table.Column<bool>(type: "INTEGER", nullable: false),
                    end_time = table.Column<string>(type: "TEXT", maxLength: 5, nullable: false),
                    start_time = table.Column<string>(type: "TEXT", maxLength: 5, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_camera_privacy_schedules", x => x.id);
                    table.ForeignKey(
                        name: "fk_camera_privacy_schedules_cameras_camera_id",
                        column: x => x.camera_id,
                        principalTable: "cameras",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "idx_privacy_schedules_camera",
                table: "camera_privacy_schedules",
                columns: new[] { "camera_id", "enabled" });
        }
    }
}
