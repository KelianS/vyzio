using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vyzio.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddAccountsAndSessions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "revoked",
                table: "sessions");

            migrationBuilder.DropColumn(
                name: "user_id",
                table: "sessions");

            migrationBuilder.AddColumn<string>(
                name: "account_id",
                table: "sessions",
                type: "TEXT",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "device",
                table: "sessions",
                type: "TEXT",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "last_seen_at",
                table: "sessions",
                type: "TEXT",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<DateTime>(
                name: "revoked_at",
                table: "sessions",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "token_hash",
                table: "sessions",
                type: "TEXT",
                maxLength: 64,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "accounts",
                columns: table => new
                {
                    id = table.Column<string>(type: "TEXT", nullable: false),
                    password_hash = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    role = table.Column<string>(type: "TEXT", nullable: false),
                    created_at = table.Column<DateTime>(type: "TEXT", nullable: false),
                    password_changed_at = table.Column<DateTime>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_accounts", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "idx_sessions_account",
                table: "sessions",
                column: "account_id");

            migrationBuilder.CreateIndex(
                name: "ux_sessions_token",
                table: "sessions",
                column: "token_hash",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "fk_sessions_accounts_account_id",
                table: "sessions",
                column: "account_id",
                principalTable: "accounts",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_sessions_accounts_account_id",
                table: "sessions");

            migrationBuilder.DropTable(
                name: "accounts");

            migrationBuilder.DropIndex(
                name: "idx_sessions_account",
                table: "sessions");

            migrationBuilder.DropIndex(
                name: "ux_sessions_token",
                table: "sessions");

            migrationBuilder.DropColumn(
                name: "account_id",
                table: "sessions");

            migrationBuilder.DropColumn(
                name: "device",
                table: "sessions");

            migrationBuilder.DropColumn(
                name: "last_seen_at",
                table: "sessions");

            migrationBuilder.DropColumn(
                name: "revoked_at",
                table: "sessions");

            migrationBuilder.DropColumn(
                name: "token_hash",
                table: "sessions");

            migrationBuilder.AddColumn<bool>(
                name: "revoked",
                table: "sessions",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "user_id",
                table: "sessions",
                type: "TEXT",
                maxLength: 100,
                nullable: false,
                defaultValue: "");
        }
    }
}
