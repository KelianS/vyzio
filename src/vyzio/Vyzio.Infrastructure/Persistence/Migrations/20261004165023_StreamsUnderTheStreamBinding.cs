using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vyzio.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class StreamsUnderTheStreamBinding : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // No stream is carried over: each camera's stream is chosen again, which lays its streams out (ADR-65 e).
            migrationBuilder.Sql("DELETE FROM camera_streams;");
            migrationBuilder.Sql("DELETE FROM camera_capability_bindings WHERE capability = 'stream';");

            migrationBuilder.DropForeignKey(
                name: "fk_camera_streams_cameras_camera_id",
                table: "camera_streams");

            migrationBuilder.DropIndex(
                name: "ux_camera_streams_camera_ordinal",
                table: "camera_streams");

            migrationBuilder.DropColumn(
                name: "detect_stream_id",
                table: "cameras");

            migrationBuilder.RenameColumn(
                name: "camera_id",
                table: "camera_streams",
                newName: "role");

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
                name: "streams_found_at",
                table: "camera_capability_bindings",
                type: "TEXT",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ux_camera_streams_binding_ordinal",
                table: "camera_streams",
                columns: new[] { "binding_id", "ordinal" },
                unique: true);

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

            migrationBuilder.DropIndex(
                name: "ux_camera_streams_binding_ordinal",
                table: "camera_streams");

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
                name: "streams_found_at",
                table: "camera_capability_bindings");

            migrationBuilder.RenameColumn(
                name: "role",
                table: "camera_streams",
                newName: "camera_id");

            migrationBuilder.AddColumn<string>(
                name: "detect_stream_id",
                table: "cameras",
                type: "TEXT",
                maxLength: 100,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ux_camera_streams_camera_ordinal",
                table: "camera_streams",
                columns: new[] { "camera_id", "ordinal" },
                unique: true);

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
