using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace UFMDb.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddMovieSearchIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_Movies_CreatedAtUtc",
                table: "Movies",
                column: "CreatedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_Movies_RatingCount_AverageRating",
                table: "Movies",
                columns: new[] { "RatingCount", "AverageRating" });

            migrationBuilder.CreateIndex(
                name: "IX_Movies_ReleaseDate",
                table: "Movies",
                column: "ReleaseDate");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Movies_CreatedAtUtc",
                table: "Movies");

            migrationBuilder.DropIndex(
                name: "IX_Movies_RatingCount_AverageRating",
                table: "Movies");

            migrationBuilder.DropIndex(
                name: "IX_Movies_ReleaseDate",
                table: "Movies");
        }
    }
}
