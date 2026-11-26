using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace UFMDb.Persistence.Migrations;

/// <inheritdoc />
public partial class MigrateActorsDirectorsToPeople : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // 1) Aktörler -> People. Önce TmdbId ile zaten var olan kişileri bağla, kalanları ekle.
        migrationBuilder.Sql("""
            UPDATE "People" p SET "LegacyActorId" = a."Id"
            FROM "Actors" a
            WHERE a."TmdbId" IS NOT NULL AND p."TmdbId" = a."TmdbId" AND p."LegacyActorId" IS NULL;

            INSERT INTO "People" ("Id","TmdbId","LegacyActorId","FullName","BirthDate","Biography","PhotoUrl","Nationality","LikeCount","CreatedAtUtc","UpdatedAtUtc","IsDeleted")
            SELECT gen_random_uuid(), a."TmdbId", a."Id", a."FullName", a."BirthDate", a."Biography", a."PhotoUrl", a."Nationality", 0, a."CreatedAtUtc", now(), a."IsDeleted"
            FROM "Actors" a
            WHERE NOT EXISTS (SELECT 1 FROM "People" p WHERE p."LegacyActorId" = a."Id")
              AND (a."TmdbId" IS NULL OR NOT EXISTS (SELECT 1 FROM "People" p WHERE p."TmdbId" = a."TmdbId"));
            """);

        // 2) Yönetmenler -> People. TmdbId aynıysa mevcut kişiye bağlanır (hem aktör hem yönetmen = tek satır).
        migrationBuilder.Sql("""
            UPDATE "People" p SET "LegacyDirectorId" = d."Id"
            FROM "Directors" d
            WHERE d."TmdbId" IS NOT NULL AND p."TmdbId" = d."TmdbId" AND p."LegacyDirectorId" IS NULL;

            INSERT INTO "People" ("Id","TmdbId","LegacyDirectorId","FullName","BirthDate","Biography","PhotoUrl","Nationality","LikeCount","CreatedAtUtc","UpdatedAtUtc","IsDeleted")
            SELECT gen_random_uuid(), d."TmdbId", d."Id", d."FullName", d."BirthDate", d."Biography", d."PhotoUrl", d."Nationality", 0, d."CreatedAtUtc", now(), d."IsDeleted"
            FROM "Directors" d
            WHERE NOT EXISTS (SELECT 1 FROM "People" p WHERE p."LegacyDirectorId" = d."Id")
              AND (d."TmdbId" IS NULL OR NOT EXISTS (SELECT 1 FROM "People" p WHERE p."TmdbId" = d."TmdbId"));
            """);

        // 3) Krediler. Aynı film/kişi/tür zaten varsa (TMDB sync'ten) atlanır.
        migrationBuilder.Sql("""
            INSERT INTO "MovieCredits" ("Id","MovieId","PersonId","Kind","Department","Job","CharacterName","Order","TmdbCreditId")
            SELECT gen_random_uuid(), ma."MovieId", p."Id", 'Cast', 'Acting', '', NULLIF(ma."CharacterName", ''), ma."Order", NULL
            FROM "MovieActors" ma
            JOIN "People" p ON p."LegacyActorId" = ma."ActorId"
            WHERE NOT EXISTS (SELECT 1 FROM "MovieCredits" c
                              WHERE c."MovieId" = ma."MovieId" AND c."PersonId" = p."Id" AND c."Kind" = 'Cast');

            INSERT INTO "MovieCredits" ("Id","MovieId","PersonId","Kind","Department","Job","CharacterName","Order","TmdbCreditId")
            SELECT gen_random_uuid(), md."MovieId", p."Id", 'Crew', 'Directing', 'Director', NULL, md."Order", NULL
            FROM "MovieDirectors" md
            JOIN "People" p ON p."LegacyDirectorId" = md."DirectorId"
            WHERE NOT EXISTS (SELECT 1 FROM "MovieCredits" c
                              WHERE c."MovieId" = md."MovieId" AND c."PersonId" = p."Id" AND c."Kind" = 'Crew' AND c."Job" = 'Director');
            """);

        // 4) Beğeniler: aktör + yönetmen beğenileri birleşir, aynı kullanıcı aynı kişiyi iki kez beğenmiş sayılmaz.
        migrationBuilder.Sql("""
            INSERT INTO "PersonLikes" ("Id","PersonId","UserId","CreatedAtUtc","UpdatedAtUtc","IsDeleted")
            SELECT DISTINCT ON (x."PersonId", x."UserId")
                   gen_random_uuid(), x."PersonId", x."UserId", x."CreatedAtUtc", now(), false
            FROM (
                SELECT p."Id" AS "PersonId", l."UserId", l."CreatedAtUtc"
                FROM "ActorLikes" l JOIN "People" p ON p."LegacyActorId" = l."ActorId"
                WHERE NOT l."IsDeleted"
                UNION ALL
                SELECT p."Id", l."UserId", l."CreatedAtUtc"
                FROM "DirectorLikes" l JOIN "People" p ON p."LegacyDirectorId" = l."DirectorId"
                WHERE NOT l."IsDeleted"
            ) x
            WHERE NOT EXISTS (SELECT 1 FROM "PersonLikes" pl WHERE pl."PersonId" = x."PersonId" AND pl."UserId" = x."UserId")
            ORDER BY x."PersonId", x."UserId", x."CreatedAtUtc";

            UPDATE "People" p SET "LikeCount" =
                (SELECT COUNT(*) FROM "PersonLikes" pl WHERE pl."PersonId" = p."Id" AND NOT pl."IsDeleted");
            """);

        // 5) Favoriler: oyuncu ve yönetmen listeleri Role ile ayrı kalır.
        migrationBuilder.Sql("""
            INSERT INTO "FavoritePeople" ("UserId","Role","Slot","PersonId")
            SELECT fa."UserId", 'Actor', fa."Slot", p."Id"
            FROM "FavoriteActors" fa JOIN "People" p ON p."LegacyActorId" = fa."ActorId"
            WHERE NOT EXISTS (SELECT 1 FROM "FavoritePeople" f
                              WHERE f."UserId" = fa."UserId" AND f."Role" = 'Actor' AND f."Slot" = fa."Slot");

            INSERT INTO "FavoritePeople" ("UserId","Role","Slot","PersonId")
            SELECT fd."UserId", 'Director', fd."Slot", p."Id"
            FROM "FavoriteDirectors" fd JOIN "People" p ON p."LegacyDirectorId" = fd."DirectorId"
            WHERE NOT EXISTS (SELECT 1 FROM "FavoritePeople" f
                              WHERE f."UserId" = fd."UserId" AND f."Role" = 'Director' AND f."Slot" = fd."Slot");
            """);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // Veri taşıma geri alınmaz: eski Actor/Director tabloları silinmediği için veri kaybı yok.
        // Gerekirse yeni tabloları temizlemek için AddPersonSystem migration'ına dön.
    }
}