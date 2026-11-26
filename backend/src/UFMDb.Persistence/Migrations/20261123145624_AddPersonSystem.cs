using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace UFMDb.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPersonSystem : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_People_Actors_LegacyActorId",
                table: "People");

            migrationBuilder.DropForeignKey(
                name: "FK_People_Directors_LegacyDirectorId",
                table: "People");

            migrationBuilder.DropIndex(
                name: "IX_People_LegacyActorId",
                table: "People");

            migrationBuilder.DropIndex(
                name: "IX_People_LegacyDirectorId",
                table: "People");

            migrationBuilder.DropIndex(
                name: "IX_MovieCredits_MovieId_TmdbCreditId",
                table: "MovieCredits");

            migrationBuilder.DropIndex(
                name: "IX_MovieCredits_PersonId",
                table: "MovieCredits");

            migrationBuilder.AlterColumn<string>(
                name: "PhotoUrl",
                table: "People",
                type: "character varying(500)",
                maxLength: 500,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "Nationality",
                table: "People",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AddColumn<int>(
                name: "LikeCount",
                table: "People",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AlterColumn<string>(
                name: "TmdbCreditId",
                table: "MovieCredits",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "Kind",
                table: "MovieCredits",
                type: "character varying(10)",
                maxLength: 10,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "Job",
                table: "MovieCredits",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "Department",
                table: "MovieCredits",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "CharacterName",
                table: "MovieCredits",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);

            migrationBuilder.CreateTable(
                name: "FavoritePeople",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Role = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Slot = table.Column<int>(type: "integer", nullable: false),
                    PersonId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FavoritePeople", x => new { x.UserId, x.Role, x.Slot });
                    table.ForeignKey(
                        name: "FK_FavoritePeople_People_PersonId",
                        column: x => x.PersonId,
                        principalTable: "People",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FavoritePeople_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PersonLikes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PersonId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PersonLikes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PersonLikes_People_PersonId",
                        column: x => x.PersonId,
                        principalTable: "People",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PersonLikes_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_People_LegacyActorId",
                table: "People",
                column: "LegacyActorId",
                unique: true,
                filter: "\"LegacyActorId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_People_LegacyDirectorId",
                table: "People",
                column: "LegacyDirectorId",
                unique: true,
                filter: "\"LegacyDirectorId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_MovieCredits_MovieId_Kind_Order",
                table: "MovieCredits",
                columns: new[] { "MovieId", "Kind", "Order" });

            migrationBuilder.CreateIndex(
                name: "IX_MovieCredits_PersonId_MovieId",
                table: "MovieCredits",
                columns: new[] { "PersonId", "MovieId" });

            migrationBuilder.CreateIndex(
                name: "IX_MovieCredits_TmdbCreditId",
                table: "MovieCredits",
                column: "TmdbCreditId",
                unique: true,
                filter: "\"TmdbCreditId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_FavoritePeople_PersonId",
                table: "FavoritePeople",
                column: "PersonId");

            migrationBuilder.CreateIndex(
                name: "IX_PersonLikes_PersonId_UserId",
                table: "PersonLikes",
                columns: new[] { "PersonId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PersonLikes_UserId",
                table: "PersonLikes",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FavoritePeople");

            migrationBuilder.DropTable(
                name: "PersonLikes");

            migrationBuilder.DropIndex(
                name: "IX_People_LegacyActorId",
                table: "People");

            migrationBuilder.DropIndex(
                name: "IX_People_LegacyDirectorId",
                table: "People");

            migrationBuilder.DropIndex(
                name: "IX_MovieCredits_MovieId_Kind_Order",
                table: "MovieCredits");

            migrationBuilder.DropIndex(
                name: "IX_MovieCredits_PersonId_MovieId",
                table: "MovieCredits");

            migrationBuilder.DropIndex(
                name: "IX_MovieCredits_TmdbCreditId",
                table: "MovieCredits");

            migrationBuilder.DropColumn(
                name: "LikeCount",
                table: "People");

            migrationBuilder.AlterColumn<string>(
                name: "PhotoUrl",
                table: "People",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(500)",
                oldMaxLength: 500);

            migrationBuilder.AlterColumn<string>(
                name: "Nationality",
                table: "People",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(100)",
                oldMaxLength: 100);

            migrationBuilder.AlterColumn<string>(
                name: "TmdbCreditId",
                table: "MovieCredits",
                type: "text",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(50)",
                oldMaxLength: 50,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "Kind",
                table: "MovieCredits",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(10)",
                oldMaxLength: 10);

            migrationBuilder.AlterColumn<string>(
                name: "Job",
                table: "MovieCredits",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(100)",
                oldMaxLength: 100);

            migrationBuilder.AlterColumn<string>(
                name: "Department",
                table: "MovieCredits",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(50)",
                oldMaxLength: 50);

            migrationBuilder.AlterColumn<string>(
                name: "CharacterName",
                table: "MovieCredits",
                type: "text",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(500)",
                oldMaxLength: 500,
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_People_LegacyActorId",
                table: "People",
                column: "LegacyActorId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_People_LegacyDirectorId",
                table: "People",
                column: "LegacyDirectorId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MovieCredits_MovieId_TmdbCreditId",
                table: "MovieCredits",
                columns: new[] { "MovieId", "TmdbCreditId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MovieCredits_PersonId",
                table: "MovieCredits",
                column: "PersonId");

            migrationBuilder.AddForeignKey(
                name: "FK_People_Actors_LegacyActorId",
                table: "People",
                column: "LegacyActorId",
                principalTable: "Actors",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_People_Directors_LegacyDirectorId",
                table: "People",
                column: "LegacyDirectorId",
                principalTable: "Directors",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }
    }
}
