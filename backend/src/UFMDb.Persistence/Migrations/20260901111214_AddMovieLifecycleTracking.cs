using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace UFMDb.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddMovieLifecycleTracking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "LastTmdbSyncAt",
                table: "Movies",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LifecycleStatus",
                table: "Movies",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "PostReleaseSyncedAt",
                table: "Movies",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Movies_LifecycleStatus_ReleaseDate",
                table: "Movies",
                columns: new[] { "LifecycleStatus", "ReleaseDate" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Movies_LifecycleStatus_ReleaseDate",
                table: "Movies");

            migrationBuilder.DropColumn(
                name: "LastTmdbSyncAt",
                table: "Movies");

            migrationBuilder.DropColumn(
                name: "LifecycleStatus",
                table: "Movies");

            migrationBuilder.DropColumn(
                name: "PostReleaseSyncedAt",
                table: "Movies");
        }
    }
}
