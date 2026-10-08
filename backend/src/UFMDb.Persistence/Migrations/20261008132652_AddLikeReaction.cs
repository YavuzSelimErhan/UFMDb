using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace UFMDb.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddLikeReaction : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "DislikeCount",
                table: "Movies",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "Reaction",
                table: "Likes",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Like");

            migrationBuilder.CreateIndex(
                name: "IX_Likes_MovieId_Reaction",
                table: "Likes",
                columns: new[] { "MovieId", "Reaction" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Likes_MovieId_Reaction",
                table: "Likes");

            migrationBuilder.DropColumn(
                name: "DislikeCount",
                table: "Movies");

            migrationBuilder.DropColumn(
                name: "Reaction",
                table: "Likes");
        }
    }
}
