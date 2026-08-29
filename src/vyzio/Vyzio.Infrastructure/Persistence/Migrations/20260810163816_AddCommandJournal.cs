using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vyzio.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCommandJournal : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
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

            migrationBuilder.CreateIndex(
                name: "idx_command_journal_origin",
                table: "command_journal",
                columns: new[] { "channel", "conversation_id", "received_at" });

            migrationBuilder.CreateIndex(
                name: "idx_command_journal_received",
                table: "command_journal",
                column: "received_at");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "command_journal");
        }
    }
}
