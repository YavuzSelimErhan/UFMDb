using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace UFMDb.Persistence.Migrations;

/// <inheritdoc />
public partial class FixLegacyCastCreditJob : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // Importer zaten TMDB kimlikli bir oyuncu kredisi eklemişse, taşıma sırasında oluşan boş-Job'lu kopyayı sil.
        migrationBuilder.Sql("""
            DELETE FROM "MovieCredits" c
            WHERE c."Kind" = 'Cast' AND c."Job" = '' AND c."TmdbCreditId" IS NULL
              AND EXISTS (SELECT 1 FROM "MovieCredits" d
                          WHERE d."MovieId" = c."MovieId" AND d."PersonId" = c."PersonId"
                            AND d."Kind" = 'Cast' AND d."TmdbCreditId" IS NOT NULL);
            """);

        // Kalan taşınmış oyuncu kredilerini importer'ın kullandığı değere eşitle ki sonraki sync bunları eşleştirsin.
        migrationBuilder.Sql("""
            UPDATE "MovieCredits" SET "Job" = 'Actor' WHERE "Kind" = 'Cast' AND "Job" = '';
            """);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
    }
}