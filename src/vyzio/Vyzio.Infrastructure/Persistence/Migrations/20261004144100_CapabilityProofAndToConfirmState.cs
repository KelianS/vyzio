using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vyzio.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class CapabilityProofAndToConfirmState : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "verified",
                table: "camera_capability_bindings");

            migrationBuilder.AddColumn<DateTime>(
                name: "confirmed_at",
                table: "camera_capability_bindings",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "status",
                table: "camera_capability_bindings",
                type: "TEXT",
                nullable: false,
                defaultValue: "failed");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "confirmed_at",
                table: "camera_capability_bindings");

            migrationBuilder.DropColumn(
                name: "status",
                table: "camera_capability_bindings");

            migrationBuilder.AddColumn<bool>(
                name: "verified",
                table: "camera_capability_bindings",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);
        }
    }
}
