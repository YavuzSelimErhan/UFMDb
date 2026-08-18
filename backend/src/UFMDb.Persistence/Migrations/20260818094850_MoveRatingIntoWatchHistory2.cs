using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace UFMDb.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class MoveRatingIntoWatchHistory2 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_FavoriteDirectors_Directors_DirectorId1",
                table: "FavoriteDirectors");

            migrationBuilder.DropIndex(
                name: "IX_FavoriteDirectors_DirectorId1",
                table: "FavoriteDirectors");

            migrationBuilder.DropColumn(
                name: "DirectorId1",
                table: "FavoriteDirectors");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "DirectorId1",
                table: "FavoriteDirectors",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_FavoriteDirectors_DirectorId1",
                table: "FavoriteDirectors",
                column: "DirectorId1");

            migrationBuilder.AddForeignKey(
                name: "FK_FavoriteDirectors_Directors_DirectorId1",
                table: "FavoriteDirectors",
                column: "DirectorId1",
                principalTable: "Directors",
                principalColumn: "Id");
        }
    }
}
