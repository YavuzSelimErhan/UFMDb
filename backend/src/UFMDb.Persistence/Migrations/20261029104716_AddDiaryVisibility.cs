using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace UFMDb.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDiaryVisibility : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_WatchHistory_UserId",
                table: "WatchHistory");

            migrationBuilder.AddColumn<string>(
                name: "DiaryVisibility",
                table: "Users",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Public");

            migrationBuilder.CreateIndex(
                name: "IX_WatchHistory_UserId_WatchedAtUtc",
                table: "WatchHistory",
                columns: new[] { "UserId", "WatchedAtUtc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_WatchHistory_UserId_WatchedAtUtc",
                table: "WatchHistory");

            migrationBuilder.DropColumn(
                name: "DiaryVisibility",
                table: "Users");

            migrationBuilder.CreateIndex(
                name: "IX_WatchHistory_UserId",
                table: "WatchHistory",
                column: "UserId");
        }
    }
}
