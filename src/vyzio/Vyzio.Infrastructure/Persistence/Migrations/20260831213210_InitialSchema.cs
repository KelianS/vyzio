using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vyzio.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "accounts",
                columns: table => new
                {
                    id = table.Column<string>(type: "TEXT", nullable: false),
                    password_hash = table.Column<string>(type: "TEXT", maxLength: 200, nullable: true),
                    role = table.Column<string>(type: "TEXT", nullable: false),
                    created_at = table.Column<DateTime>(type: "TEXT", nullable: false),
                    password_changed_at = table.Column<DateTime>(type: "TEXT", nullable: true),
                    password_forgotten_at = table.Column<DateTime>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_accounts", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "cameras",
                columns: table => new
                {
                    id = table.Column<string>(type: "TEXT", nullable: false),
                    slug = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    display_name = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    source_type = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    host = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    port = table.Column<int>(type: "INTEGER", nullable: false),
                    username = table.Column<string>(type: "TEXT", maxLength: 200, nullable: true),
                    password = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true),
                    stream_protocol = table.Column<string>(type: "TEXT", nullable: false),
                    detect_stream_id = table.Column<string>(type: "TEXT", maxLength: 100, nullable: true),
                    device_id = table.Column<string>(type: "TEXT", maxLength: 200, nullable: true),
                    vendor_family = table.Column<string>(type: "TEXT", nullable: true),
                    detection_labels_json = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true),
                    supported_protocols_json = table.Column<string>(type: "TEXT", nullable: true),
                    continuous_days_override = table.Column<int>(type: "INTEGER", nullable: true),
                    motion_days_override = table.Column<int>(type: "INTEGER", nullable: true),
                    event_clip_days_override = table.Column<int>(type: "INTEGER", nullable: true),
                    motion_sensitivity = table.Column<int>(type: "INTEGER", nullable: false),
                    motion_sensitivity_pinned = table.Column<bool>(type: "INTEGER", nullable: false),
                    status = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    last_reachability_check_at = table.Column<DateTime>(type: "TEXT", nullable: true),
                    last_successful_frame_at = table.Column<DateTime>(type: "TEXT", nullable: true),
                    frigate_camera_name = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    validation_state = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    is_enabled = table.Column<bool>(type: "INTEGER", nullable: false),
                    privacy_mode_active = table.Column<bool>(type: "INTEGER", nullable: false),
                    privacy_mode_source = table.Column<string>(type: "TEXT", nullable: true),
                    privacy_vendor_cut = table.Column<bool>(type: "INTEGER", nullable: false),
                    ptz_supported = table.Column<bool>(type: "INTEGER", nullable: false),
                    privacy_strategy = table.Column<string>(type: "TEXT", nullable: false),
                    created_at = table.Column<DateTime>(type: "TEXT", nullable: false),
                    updated_at = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_cameras", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "channel_pairings",
                columns: table => new
                {
                    id = table.Column<string>(type: "TEXT", nullable: false),
                    channel = table.Column<string>(type: "TEXT", nullable: false),
                    conversation_id = table.Column<string>(type: "TEXT", maxLength: 100, nullable: true),
                    pairing_code = table.Column<string>(type: "TEXT", maxLength: 20, nullable: true),
                    code_expires_at = table.Column<DateTime>(type: "TEXT", nullable: true),
                    paired_at = table.Column<DateTime>(type: "TEXT", nullable: true),
                    failed_attempts = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_channel_pairings", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "command_journal",
                columns: table => new
                {
                    id = table.Column<string>(type: "TEXT", nullable: false),
                    channel = table.Column<string>(type: "TEXT", nullable: false),
                    conversation_id = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    command = table.Column<string>(type: "TEXT", nullable: false),
                    outcome = table.Column<string>(type: "TEXT", nullable: false),
                    received_at = table.Column<DateTime>(type: "TEXT", nullable: false),
                    error_message = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_command_journal", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "notification_channel_configs",
                columns: table => new
                {
                    id = table.Column<string>(type: "TEXT", nullable: false),
                    channel = table.Column<string>(type: "TEXT", nullable: false),
                    is_enabled = table.Column<bool>(type: "INTEGER", nullable: false),
                    credentials_json = table.Column<string>(type: "TEXT", nullable: true),
                    minimum_confidence = table.Column<float>(type: "REAL", nullable: false),
                    allowed_labels_json = table.Column<string>(type: "TEXT", nullable: true),
                    active_from_hour = table.Column<int>(type: "INTEGER", nullable: true),
                    active_to_hour = table.Column<int>(type: "INTEGER", nullable: true),
                    cooldown_minutes = table.Column<int>(type: "INTEGER", nullable: true),
                    message_fields_json = table.Column<string>(type: "TEXT", nullable: true),
                    media_mode = table.Column<string>(type: "TEXT", nullable: false),
                    configured_at = table.Column<DateTime>(type: "TEXT", nullable: true),
                    last_tested_at = table.Column<DateTime>(type: "TEXT", nullable: true),
                    last_test_outcome = table.Column<string>(type: "TEXT", nullable: true),
                    last_test_error = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_notification_channel_configs", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "notifications",
                columns: table => new
                {
                    id = table.Column<string>(type: "TEXT", nullable: false),
                    frigate_event_id = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    channel = table.Column<string>(type: "TEXT", nullable: false),
                    camera = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    label = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    status = table.Column<string>(type: "TEXT", nullable: false),
                    sent_at = table.Column<DateTime>(type: "TEXT", nullable: false),
                    error_message = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_notifications", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "profiles",
                columns: table => new
                {
                    id = table.Column<string>(type: "TEXT", nullable: false),
                    name = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    category = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    alert_mode = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    last_seen_at = table.Column<DateTime>(type: "TEXT", nullable: true),
                    created_at = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_profiles", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "ptz_presets",
                columns: table => new
                {
                    id = table.Column<string>(type: "TEXT", nullable: false),
                    camera_id = table.Column<string>(type: "TEXT", nullable: false),
                    preset_id = table.Column<int>(type: "INTEGER", nullable: false),
                    label = table.Column<string>(type: "TEXT", nullable: false),
                    native = table.Column<bool>(type: "INTEGER", nullable: false),
                    native_token = table.Column<string>(type: "TEXT", nullable: true),
                    steps_x = table.Column<int>(type: "INTEGER", nullable: true),
                    steps_y = table.Column<int>(type: "INTEGER", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_ptz_presets", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "recording_settings",
                columns: table => new
                {
                    id = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    continuous_days = table.Column<int>(type: "INTEGER", nullable: false),
                    motion_days = table.Column<int>(type: "INTEGER", nullable: false),
                    event_clip_days = table.Column<int>(type: "INTEGER", nullable: false),
                    updated_at = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_recording_settings", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "sessions",
                columns: table => new
                {
                    id = table.Column<string>(type: "TEXT", nullable: false),
                    token_hash = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    account_id = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    device = table.Column<string>(type: "TEXT", maxLength: 200, nullable: true),
                    created_at = table.Column<DateTime>(type: "TEXT", nullable: false),
                    last_seen_at = table.Column<DateTime>(type: "TEXT", nullable: false),
                    expires_at = table.Column<DateTime>(type: "TEXT", nullable: false),
                    revoked_at = table.Column<DateTime>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_sessions", x => x.id);
                    table.ForeignKey(
                        name: "fk_sessions_accounts_account_id",
                        column: x => x.account_id,
                        principalTable: "accounts",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "camera_capability_bindings",
                columns: table => new
                {
                    id = table.Column<string>(type: "TEXT", nullable: false),
                    camera_id = table.Column<string>(type: "TEXT", nullable: false),
                    capability = table.Column<string>(type: "TEXT", nullable: false),
                    protocol = table.Column<string>(type: "TEXT", nullable: false),
                    config_json = table.Column<string>(type: "TEXT", nullable: true),
                    verified = table.Column<bool>(type: "INTEGER", nullable: false),
                    manually_configured = table.Column<bool>(type: "INTEGER", nullable: false),
                    verified_at = table.Column<DateTime>(type: "TEXT", nullable: true),
                    last_error = table.Column<string>(type: "TEXT", nullable: true),
                    created_at = table.Column<DateTime>(type: "TEXT", nullable: false),
                    updated_at = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_camera_capability_bindings", x => x.id);
                    table.ForeignKey(
                        name: "fk_camera_capability_bindings_cameras_camera_id",
                        column: x => x.camera_id,
                        principalTable: "cameras",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "camera_privacy_schedules",
                columns: table => new
                {
                    id = table.Column<string>(type: "TEXT", nullable: false),
                    camera_id = table.Column<string>(type: "TEXT", nullable: false),
                    enabled = table.Column<bool>(type: "INTEGER", nullable: false),
                    days_of_week = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    start_time = table.Column<string>(type: "TEXT", maxLength: 5, nullable: false),
                    end_time = table.Column<string>(type: "TEXT", maxLength: 5, nullable: false),
                    created_at = table.Column<DateTime>(type: "TEXT", nullable: false)
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

            migrationBuilder.CreateTable(
                name: "camera_streams",
                columns: table => new
                {
                    id = table.Column<string>(type: "TEXT", nullable: false),
                    camera_id = table.Column<string>(type: "TEXT", nullable: false),
                    ordinal = table.Column<int>(type: "INTEGER", nullable: false),
                    path = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true),
                    width = table.Column<int>(type: "INTEGER", nullable: true),
                    height = table.Column<int>(type: "INTEGER", nullable: true),
                    fps = table.Column<int>(type: "INTEGER", nullable: true),
                    created_at = table.Column<DateTime>(type: "TEXT", nullable: false),
                    updated_at = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_camera_streams", x => x.id);
                    table.ForeignKey(
                        name: "fk_camera_streams_cameras_camera_id",
                        column: x => x.camera_id,
                        principalTable: "cameras",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "profile_camera_links",
                columns: table => new
                {
                    id = table.Column<string>(type: "TEXT", nullable: false),
                    profile_id = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    camera_id = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    enabled = table.Column<bool>(type: "INTEGER", nullable: false),
                    created_at = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_profile_camera_links", x => x.id);
                    table.ForeignKey(
                        name: "fk_profile_camera_links_cameras_camera_id",
                        column: x => x.camera_id,
                        principalTable: "cameras",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_profile_camera_links_profiles_profile_id",
                        column: x => x.profile_id,
                        principalTable: "profiles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "profile_photos",
                columns: table => new
                {
                    id = table.Column<string>(type: "TEXT", nullable: false),
                    profile_id = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    filename = table.Column<string>(type: "TEXT", maxLength: 300, nullable: false),
                    frigate_synced = table.Column<bool>(type: "INTEGER", nullable: false),
                    synced_at = table.Column<DateTime>(type: "TEXT", nullable: true),
                    created_at = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_profile_photos", x => x.id);
                    table.ForeignKey(
                        name: "fk_profile_photos_profiles_profile_id",
                        column: x => x.profile_id,
                        principalTable: "profiles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ux_capability_bindings_camera_capability",
                table: "camera_capability_bindings",
                columns: new[] { "camera_id", "capability" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_privacy_schedules_camera",
                table: "camera_privacy_schedules",
                columns: new[] { "camera_id", "enabled" });

            migrationBuilder.CreateIndex(
                name: "ux_camera_streams_camera_ordinal",
                table: "camera_streams",
                columns: new[] { "camera_id", "ordinal" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_cameras_device",
                table: "cameras",
                column: "device_id");

            migrationBuilder.CreateIndex(
                name: "idx_cameras_display_name",
                table: "cameras",
                column: "display_name");

            migrationBuilder.CreateIndex(
                name: "idx_cameras_status",
                table: "cameras",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ux_cameras_slug",
                table: "cameras",
                column: "slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_channel_pairings_channel",
                table: "channel_pairings",
                column: "channel",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_command_journal_origin",
                table: "command_journal",
                columns: new[] { "channel", "conversation_id", "received_at" });

            migrationBuilder.CreateIndex(
                name: "idx_command_journal_received",
                table: "command_journal",
                column: "received_at");

            migrationBuilder.CreateIndex(
                name: "ux_notification_channel",
                table: "notification_channel_configs",
                column: "channel",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_notifications_cooldown",
                table: "notifications",
                columns: new[] { "channel", "camera", "label", "sent_at" });

            migrationBuilder.CreateIndex(
                name: "idx_notifications_event",
                table: "notifications",
                columns: new[] { "frigate_event_id", "channel" });

            migrationBuilder.CreateIndex(
                name: "idx_pcl_camera",
                table: "profile_camera_links",
                columns: new[] { "camera_id", "enabled" });

            migrationBuilder.CreateIndex(
                name: "idx_pcl_profile",
                table: "profile_camera_links",
                columns: new[] { "profile_id", "enabled" });

            migrationBuilder.CreateIndex(
                name: "ux_pcl_profile_camera",
                table: "profile_camera_links",
                columns: new[] { "profile_id", "camera_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_photos_profile",
                table: "profile_photos",
                column: "profile_id");

            migrationBuilder.CreateIndex(
                name: "ux_ptz_presets_camera_preset",
                table: "ptz_presets",
                columns: new[] { "camera_id", "preset_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_sessions_account",
                table: "sessions",
                column: "account_id");

            migrationBuilder.CreateIndex(
                name: "ux_sessions_token",
                table: "sessions",
                column: "token_hash",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "camera_capability_bindings");

            migrationBuilder.DropTable(
                name: "camera_privacy_schedules");

            migrationBuilder.DropTable(
                name: "camera_streams");

            migrationBuilder.DropTable(
                name: "channel_pairings");

            migrationBuilder.DropTable(
                name: "command_journal");

            migrationBuilder.DropTable(
                name: "notification_channel_configs");

            migrationBuilder.DropTable(
                name: "notifications");

            migrationBuilder.DropTable(
                name: "profile_camera_links");

            migrationBuilder.DropTable(
                name: "profile_photos");

            migrationBuilder.DropTable(
                name: "ptz_presets");

            migrationBuilder.DropTable(
                name: "recording_settings");

            migrationBuilder.DropTable(
                name: "sessions");

            migrationBuilder.DropTable(
                name: "cameras");

            migrationBuilder.DropTable(
                name: "profiles");

            migrationBuilder.DropTable(
                name: "accounts");
        }
    }
}
