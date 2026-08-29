using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vyzio.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddChannelPairing : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "channel_pairings",
                columns: table => new
                {
                    id = table.Column<string>(type: "TEXT", nullable: false),
                    channel = table.Column<string>(type: "TEXT", nullable: false),
                    conversation_id = table.Column<string>(type: "TEXT", maxLength: 100, nullable: true),
                    pairing_code = table.Column<string>(type: "TEXT", maxLength: 20, nullable: true),
                    code_expires_at = table.Column<DateTime>(type: "TEXT", nullable: true),
                    paired_at = table.Column<DateTime>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_channel_pairings", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "idx_channel_pairings_channel",
                table: "channel_pairings",
                column: "channel",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "channel_pairings");
        }
    }
}
