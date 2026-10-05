using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vyzio.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ReleaseV030 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // No stream is carried over: each camera's stream is chosen again, which lays its streams out (ADR-65).
            migrationBuilder.Sql("DELETE FROM camera_streams;");
            migrationBuilder.Sql("DELETE FROM camera_capability_bindings WHERE capability = 'stream';");

            migrationBuilder.DropForeignKey(
                name: "fk_camera_streams_cameras_camera_id",
                table: "camera_streams");

            migrationBuilder.DropTable(
                name: "camera_privacy_schedules");

            migrationBuilder.DropIndex(
                name: "ux_camera_streams_camera_ordinal",
                table: "camera_streams");

            migrationBuilder.DropColumn(
                name: "native",
                table: "ptz_presets");

            migrationBuilder.DropColumn(
                name: "native_token",
                table: "ptz_presets");

            migrationBuilder.DropColumn(
                name: "active_from_hour",
                table: "notification_channel_configs");

            migrationBuilder.DropColumn(
                name: "active_to_hour",
                table: "notification_channel_configs");

            migrationBuilder.DropColumn(
                name: "detect_stream_id",
                table: "cameras");

            migrationBuilder.DropColumn(
                name: "port",
                table: "cameras");

            migrationBuilder.DropColumn(
                name: "stream_protocol",
                table: "cameras");

            migrationBuilder.DropColumn(
                name: "verified",
                table: "camera_capability_bindings");

            migrationBuilder.RenameColumn(
                name: "steps_y",
                table: "ptz_presets",
                newName: "tilt_ms");

            migrationBuilder.RenameColumn(
                name: "steps_x",
                table: "ptz_presets",
                newName: "pan_ms");

            migrationBuilder.DropColumn(
                name: "vendor_family",
                table: "cameras");

            migrationBuilder.DropColumn(
                name: "supported_protocols_json",
                table: "cameras");

            migrationBuilder.AddColumn<string>(
                name: "privacy_miss",
                table: "cameras",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "detected_at",
                table: "cameras",
                type: "TEXT",
                nullable: true);

            migrationBuilder.RenameColumn(
                name: "camera_id",
                table: "camera_streams",
                newName: "role");

            migrationBuilder.AddColumn<string>(
                name: "privacy_miss_detail",
                table: "cameras",
                type: "TEXT",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "binding_id",
                table: "camera_streams",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "checked_at",
                table: "camera_streams",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "last_error",
                table: "camera_streams",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "protocol",
                table: "camera_streams",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "verified",
                table: "camera_streams",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "confirmed_at",
                table: "camera_capability_bindings",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "rejected_at",
                table: "camera_capability_bindings",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "status",
                table: "camera_capability_bindings",
                type: "TEXT",
                nullable: false,
                defaultValue: "failed");

            migrationBuilder.AddColumn<DateTime>(
                name: "streams_found_at",
                table: "camera_capability_bindings",
                type: "TEXT",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "camera_protocols",
                columns: table => new
                {
                    id = table.Column<string>(type: "TEXT", nullable: false),
                    camera_id = table.Column<string>(type: "TEXT", nullable: false),
                    protocol = table.Column<string>(type: "TEXT", nullable: false),
                    port = table.Column<int>(type: "INTEGER", nullable: true),
                    endpoint = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true),
                    device_id = table.Column<uint>(type: "INTEGER", nullable: true),
                    username = table.Column<string>(type: "TEXT", maxLength: 200, nullable: true),
                    password = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true),
                    status = table.Column<string>(type: "TEXT", nullable: true),
                    checked_at = table.Column<DateTime>(type: "TEXT", nullable: true),
                    last_error = table.Column<string>(type: "TEXT", maxLength: 1000, nullable: true),
                    created_at = table.Column<DateTime>(type: "TEXT", nullable: false),
                    updated_at = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_camera_protocols", x => x.id);
                    table.ForeignKey(
                        name: "fk_camera_protocols_cameras_camera_id",
                        column: x => x.camera_id,
                        principalTable: "cameras",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

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
                name: "ux_camera_streams_binding_ordinal",
                table: "camera_streams",
                columns: new[] { "binding_id", "ordinal" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ux_camera_protocols_camera_protocol",
                table: "camera_protocols",
                columns: new[] { "camera_id", "protocol" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_schedule_rules_kind",
                table: "schedule_rules",
                column: "kind");

            migrationBuilder.AddForeignKey(
                name: "fk_camera_streams_camera_capability_bindings_binding_id",
                table: "camera_streams",
                column: "binding_id",
                principalTable: "camera_capability_bindings",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_camera_streams_camera_capability_bindings_binding_id",
                table: "camera_streams");

            migrationBuilder.DropTable(
                name: "camera_protocols");

            migrationBuilder.DropTable(
                name: "schedule_rule_targets");

            migrationBuilder.DropTable(
                name: "schedule_rules");

            migrationBuilder.DropIndex(
                name: "ux_camera_streams_binding_ordinal",
                table: "camera_streams");

            migrationBuilder.DropColumn(
                name: "privacy_miss_detail",
                table: "cameras");

            migrationBuilder.DropColumn(
                name: "binding_id",
                table: "camera_streams");

            migrationBuilder.DropColumn(
                name: "checked_at",
                table: "camera_streams");

            migrationBuilder.DropColumn(
                name: "last_error",
                table: "camera_streams");

            migrationBuilder.DropColumn(
                name: "protocol",
                table: "camera_streams");

            migrationBuilder.DropColumn(
                name: "verified",
                table: "camera_streams");

            migrationBuilder.DropColumn(
                name: "confirmed_at",
                table: "camera_capability_bindings");

            migrationBuilder.DropColumn(
                name: "rejected_at",
                table: "camera_capability_bindings");

            migrationBuilder.DropColumn(
                name: "status",
                table: "camera_capability_bindings");

            migrationBuilder.DropColumn(
                name: "streams_found_at",
                table: "camera_capability_bindings");

            migrationBuilder.RenameColumn(
                name: "tilt_ms",
                table: "ptz_presets",
                newName: "steps_y");

            migrationBuilder.RenameColumn(
                name: "pan_ms",
                table: "ptz_presets",
                newName: "steps_x");

            migrationBuilder.DropColumn(
                name: "privacy_miss",
                table: "cameras");

            migrationBuilder.DropColumn(
                name: "detected_at",
                table: "cameras");

            migrationBuilder.AddColumn<string>(
                name: "vendor_family",
                table: "cameras",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "supported_protocols_json",
                table: "cameras",
                type: "TEXT",
                nullable: true);

            migrationBuilder.RenameColumn(
                name: "role",
                table: "camera_streams",
                newName: "camera_id");

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

            migrationBuilder.AddColumn<string>(
                name: "detect_stream_id",
                table: "cameras",
                type: "TEXT",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "port",
                table: "cameras",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "stream_protocol",
                table: "cameras",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "verified",
                table: "camera_capability_bindings",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

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
                name: "ux_camera_streams_camera_ordinal",
                table: "camera_streams",
                columns: new[] { "camera_id", "ordinal" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_privacy_schedules_camera",
                table: "camera_privacy_schedules",
                columns: new[] { "camera_id", "enabled" });

            migrationBuilder.AddForeignKey(
                name: "fk_camera_streams_cameras_camera_id",
                table: "camera_streams",
                column: "camera_id",
                principalTable: "cameras",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
