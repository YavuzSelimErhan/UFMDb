using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace UFMDb.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddUserCoverMovie : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "CoverMovieId",
                table: "Users",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_CoverMovieId",
                table: "Users",
                column: "CoverMovieId");

            migrationBuilder.AddForeignKey(
                name: "FK_Users_Movies_CoverMovieId",
                table: "Users",
                column: "CoverMovieId",
                principalTable: "Movies",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Users_Movies_CoverMovieId",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "IX_Users_CoverMovieId",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "CoverMovieId",
                table: "Users");
        }
    }
}
