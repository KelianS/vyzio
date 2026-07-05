using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vyzio.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ArchProtocolRefacto : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Add SupportedProtocols column (populated by the probe pipeline going forward)
            migrationBuilder.AddColumn<string>(
                name: "supported_protocols_json",
                table: "cameras",
                type: "TEXT",
                nullable: true);

            // 'software' → 'software_blur' (PrivacyStrategy renamed value)
            migrationBuilder.Sql(
                "UPDATE cameras SET privacy_mode_strategy = 'software_blur' WHERE privacy_mode_strategy = 'software'");

            // Remove legacy PtzParking and SoftwareOnly privacy bindings — strategy is now on Camera.
            // TapoKlap hardware privacy binding is kept and renamed to 'hardware_privacy'.
            migrationBuilder.Sql(
                "DELETE FROM camera_capability_bindings WHERE capability = 'privacy_mode' AND protocol != 'tapo_klap'");

            migrationBuilder.Sql(
                "UPDATE camera_capability_bindings SET capability = 'hardware_privacy' WHERE capability = 'privacy_mode'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "supported_protocols_json",
                table: "cameras");

            migrationBuilder.Sql(
                "UPDATE cameras SET privacy_mode_strategy = 'software' WHERE privacy_mode_strategy = 'software_blur'");

            migrationBuilder.Sql(
                "UPDATE camera_capability_bindings SET capability = 'privacy_mode' WHERE capability = 'hardware_privacy'");
        }
    }
}
