using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace UFMDb.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class MovieLocalizationAndTmdbFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "Budget",
                table: "Movies",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<string>(
                name: "Homepage",
                table: "Movies",
                type: "character varying(500)",
                maxLength: 500,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ImdbId",
                table: "Movies",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OriginalLanguage",
                table: "Movies",
                type: "character varying(10)",
                maxLength: 10,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "OverviewTr",
                table: "Movies",
                type: "character varying(4000)",
                maxLength: 4000,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<long>(
                name: "Revenue",
                table: "Movies",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<string>(
                name: "Tagline",
                table: "Movies",
                type: "character varying(500)",
                maxLength: 500,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "TaglineTr",
                table: "Movies",
                type: "character varying(500)",
                maxLength: 500,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "TitleTr",
                table: "Movies",
                type: "character varying(300)",
                maxLength: 300,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<double>(
                name: "TmdbPopularity",
                table: "Movies",
                type: "double precision",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<string>(
                name: "TmdbStatus",
                table: "Movies",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "TrailerKey",
                table: "Movies",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_Movies_ImdbId",
                table: "Movies",
                column: "ImdbId",
                unique: true,
                filter: "\"ImdbId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Movies_TitleTr",
                table: "Movies",
                column: "TitleTr");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Movies_ImdbId",
                table: "Movies");

            migrationBuilder.DropIndex(
                name: "IX_Movies_TitleTr",
                table: "Movies");

            migrationBuilder.DropColumn(
                name: "Budget",
                table: "Movies");

            migrationBuilder.DropColumn(
                name: "Homepage",
                table: "Movies");

            migrationBuilder.DropColumn(
                name: "ImdbId",
                table: "Movies");

            migrationBuilder.DropColumn(
                name: "OriginalLanguage",
                table: "Movies");

            migrationBuilder.DropColumn(
                name: "OverviewTr",
                table: "Movies");

            migrationBuilder.DropColumn(
                name: "Revenue",
                table: "Movies");

            migrationBuilder.DropColumn(
                name: "Tagline",
                table: "Movies");

            migrationBuilder.DropColumn(
                name: "TaglineTr",
                table: "Movies");

            migrationBuilder.DropColumn(
                name: "TitleTr",
                table: "Movies");

            migrationBuilder.DropColumn(
                name: "TmdbPopularity",
                table: "Movies");

            migrationBuilder.DropColumn(
                name: "TmdbStatus",
                table: "Movies");

            migrationBuilder.DropColumn(
                name: "TrailerKey",
                table: "Movies");
        }
    }
}
