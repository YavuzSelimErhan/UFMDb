using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace UFMDb.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ExpandCuratedLists : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_CuratedLists_IsOfficial",
                table: "CuratedLists");

            migrationBuilder.AlterColumn<string>(
                name: "TitleTr",
                table: "CuratedLists",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "Description",
                table: "CuratedLists",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "CoverImageUrl",
                table: "CuratedLists",
                type: "character varying(500)",
                maxLength: 500,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AddColumn<string>(
                name: "DescriptionTr",
                table: "CuratedLists",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "IsRanked",
                table: "CuratedLists",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "ItemCount",
                table: "CuratedLists",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "PublishedAt",
                table: "CuratedLists",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Slug",
                table: "CuratedLists",
                type: "character varying(250)",
                maxLength: 250,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "CuratedLists",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Published");

            migrationBuilder.AddColumn<int>(
                name: "ViewCount",
                table: "CuratedLists",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "Visibility",
                table: "CuratedLists",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Public");

            migrationBuilder.AddColumn<DateTime>(
                name: "AddedAt",
                table: "CuratedListItems",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<string>(
                name: "Note",
                table: "CuratedListItems",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NoteTr",
                table: "CuratedListItems",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            // ---- Mevcut kayıtlar için backfill (unique Slug index'inden ÖNCE çalışmalı) ----
            migrationBuilder.Sql("""
                -- Slug: başlıktan üret (Türkçe karakterleri sadeleştir), çakışanlara -2, -3 ekle
                WITH base AS (
                    SELECT "Id",
                           NULLIF(
                               trim(both '-' from regexp_replace(
                                   lower(translate("Title", 'ığüşöçİĞÜŞÖÇ', 'igusocigusoc')),
                                   '[^a-z0-9]+', '-', 'g')),
                               '') AS s,
                           "CreatedAtUtc"
                    FROM "CuratedLists"
                ),
                ranked AS (
                    SELECT "Id",
                           COALESCE(s, "Id"::text) AS s,
                           row_number() OVER (PARTITION BY COALESCE(s, "Id"::text)
                                              ORDER BY "CreatedAtUtc", "Id") AS rn
                    FROM base
                )
                UPDATE "CuratedLists" c
                SET "Slug" = CASE WHEN r.rn = 1 THEN r.s ELSE r.s || '-' || r.rn END
                FROM ranked r
                WHERE c."Id" = r."Id";

                -- Denormalize sayaç: mevcut listelerin film sayısı
                UPDATE "CuratedLists" c
                SET "ItemCount" = (SELECT COUNT(*) FROM "CuratedListItems" i WHERE i."CuratedListId" = c."Id");

                -- Mevcut listeler zaten yayında sayılır
                UPDATE "CuratedLists" SET "PublishedAt" = "CreatedAtUtc" WHERE "PublishedAt" IS NULL;

                -- Mevcut item'lar için AddedAt
                UPDATE "CuratedListItems" SET "AddedAt" = now() AT TIME ZONE 'utc' WHERE "AddedAt" < '2000-01-01';
                """);

            migrationBuilder.CreateIndex(
                name: "IX_CuratedLists_IsOfficial_Visibility_Status",
                table: "CuratedLists",
                columns: new[] { "IsOfficial", "Visibility", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_CuratedLists_Slug",
                table: "CuratedLists",
                column: "Slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CuratedListItems_CuratedListId_Order",
                table: "CuratedListItems",
                columns: new[] { "CuratedListId", "Order" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_CuratedLists_IsOfficial_Visibility_Status",
                table: "CuratedLists");

            migrationBuilder.DropIndex(
                name: "IX_CuratedLists_Slug",
                table: "CuratedLists");

            migrationBuilder.DropIndex(
                name: "IX_CuratedListItems_CuratedListId_Order",
                table: "CuratedListItems");

            migrationBuilder.DropColumn(
                name: "DescriptionTr",
                table: "CuratedLists");

            migrationBuilder.DropColumn(
                name: "IsRanked",
                table: "CuratedLists");

            migrationBuilder.DropColumn(
                name: "ItemCount",
                table: "CuratedLists");

            migrationBuilder.DropColumn(
                name: "PublishedAt",
                table: "CuratedLists");

            migrationBuilder.DropColumn(
                name: "Slug",
                table: "CuratedLists");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "CuratedLists");

            migrationBuilder.DropColumn(
                name: "ViewCount",
                table: "CuratedLists");

            migrationBuilder.DropColumn(
                name: "Visibility",
                table: "CuratedLists");

            migrationBuilder.DropColumn(
                name: "AddedAt",
                table: "CuratedListItems");

            migrationBuilder.DropColumn(
                name: "Note",
                table: "CuratedListItems");

            migrationBuilder.DropColumn(
                name: "NoteTr",
                table: "CuratedListItems");

            migrationBuilder.AlterColumn<string>(
                name: "TitleTr",
                table: "CuratedLists",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(200)",
                oldMaxLength: 200);

            migrationBuilder.AlterColumn<string>(
                name: "Description",
                table: "CuratedLists",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(2000)",
                oldMaxLength: 2000);

            migrationBuilder.AlterColumn<string>(
                name: "CoverImageUrl",
                table: "CuratedLists",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(500)",
                oldMaxLength: 500);

            migrationBuilder.CreateIndex(
                name: "IX_CuratedLists_IsOfficial",
                table: "CuratedLists",
                column: "IsOfficial");
        }
    }
}