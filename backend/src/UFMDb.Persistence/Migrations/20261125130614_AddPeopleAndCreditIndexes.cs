using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace UFMDb.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPeopleAndCreditIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_People_LikeCount_FullName",
                table: "People",
                columns: new[] { "LikeCount", "FullName" });

            migrationBuilder.CreateIndex(
                name: "IX_MovieCredits_Cast_PersonId",
                table: "MovieCredits",
                column: "PersonId",
                filter: "\"Kind\" = 'Cast'");

            migrationBuilder.CreateIndex(
                name: "IX_FavoritePeople_UserId_Role_PersonId",
                table: "FavoritePeople",
                columns: new[] { "UserId", "Role", "PersonId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_People_LikeCount_FullName",
                table: "People");

            migrationBuilder.DropIndex(
                name: "IX_MovieCredits_Cast_PersonId",
                table: "MovieCredits");

            migrationBuilder.DropIndex(
                name: "IX_FavoritePeople_UserId_Role_PersonId",
                table: "FavoritePeople");
        }
    }
}
