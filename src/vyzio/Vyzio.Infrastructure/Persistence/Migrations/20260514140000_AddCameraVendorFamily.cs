using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Vyzio.Infrastructure.Persistence;

#nullable disable

namespace Vyzio.Infrastructure.Persistence.Migrations;

[DbContext(typeof(VyzioDbContext))]
[Migration("20260514140000_AddCameraVendorFamily")]
public partial class AddCameraVendorFamily : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "vendor_family",
            table: "cameras",
            type: "TEXT",
            maxLength: 100,
            nullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "vendor_family",
            table: "cameras");
    }
}