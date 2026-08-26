using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace UFMDb.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddListOwnershipAndLikes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "CreatedByUserId",
                table: "CuratedLists",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<bool>(
                name: "IsOfficial",
                table: "CuratedLists",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "LikeCount",
                table: "CuratedLists",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "CuratedListLikes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CuratedListId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CuratedListLikes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CuratedListLikes_CuratedLists_CuratedListId",
                        column: x => x.CuratedListId,
                        principalTable: "CuratedLists",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CuratedListLikes_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CuratedLists_CreatedByUserId",
                table: "CuratedLists",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_CuratedLists_IsOfficial",
                table: "CuratedLists",
                column: "IsOfficial");

            migrationBuilder.CreateIndex(
                name: "IX_CuratedListLikes_CuratedListId_UserId",
                table: "CuratedListLikes",
                columns: new[] { "CuratedListId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CuratedListLikes_UserId",
                table: "CuratedListLikes",
                column: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_CuratedLists_Users_CreatedByUserId",
                table: "CuratedLists",
                column: "CreatedByUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_CuratedLists_Users_CreatedByUserId",
                table: "CuratedLists");

            migrationBuilder.DropTable(
                name: "CuratedListLikes");

            migrationBuilder.DropIndex(
                name: "IX_CuratedLists_CreatedByUserId",
                table: "CuratedLists");

            migrationBuilder.DropIndex(
                name: "IX_CuratedLists_IsOfficial",
                table: "CuratedLists");

            migrationBuilder.DropColumn(
                name: "CreatedByUserId",
                table: "CuratedLists");

            migrationBuilder.DropColumn(
                name: "IsOfficial",
                table: "CuratedLists");

            migrationBuilder.DropColumn(
                name: "LikeCount",
                table: "CuratedLists");
        }
    }
}
