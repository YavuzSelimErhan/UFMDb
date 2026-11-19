using Microsoft.EntityFrameworkCore.Migrations;

namespace UFMDb.Persistence.Migrations;

public partial class AddPeopleAndMovieCredits : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            LOCK TABLE "Actors", "Directors", "MovieActors", "MovieDirectors" IN SHARE MODE;

            CREATE TABLE "People" (
                "Id" uuid CONSTRAINT "PK_People" PRIMARY KEY,
                "TmdbId" integer,
                "LegacyActorId" uuid CONSTRAINT "FK_People_Actors_LegacyActorId" REFERENCES "Actors" ("Id") ON DELETE SET NULL,
                "LegacyDirectorId" uuid CONSTRAINT "FK_People_Directors_LegacyDirectorId" REFERENCES "Directors" ("Id") ON DELETE SET NULL,
                "FullName" varchar(200) NOT NULL,
                "BirthDate" timestamptz,
                "Biography" text NOT NULL,
                "PhotoUrl" text NOT NULL,
                "Nationality" text NOT NULL,
                "CreatedAtUtc" timestamptz NOT NULL,
                "UpdatedAtUtc" timestamptz,
                "IsDeleted" boolean NOT NULL
            );
            CREATE UNIQUE INDEX "IX_People_TmdbId" ON "People" ("TmdbId") WHERE "TmdbId" IS NOT NULL;
            CREATE UNIQUE INDEX "IX_People_LegacyActorId" ON "People" ("LegacyActorId");
            CREATE UNIQUE INDEX "IX_People_LegacyDirectorId" ON "People" ("LegacyDirectorId");
            CREATE INDEX "IX_People_FullName" ON "People" ("FullName");

            INSERT INTO "People" ("Id", "TmdbId", "LegacyActorId", "LegacyDirectorId", "FullName",
                "BirthDate", "Biography", "PhotoUrl", "Nationality", "CreatedAtUtc", "UpdatedAtUtc", "IsDeleted")
            SELECT gen_random_uuid(), CASE WHEN coalesce(a."TmdbId", d."TmdbId") > 0
                                           THEN coalesce(a."TmdbId", d."TmdbId") END,
                a."Id", d."Id", coalesce(nullif(a."FullName", ''), d."FullName", ''),
                coalesce(a."BirthDate", d."BirthDate"),
                coalesce(nullif(a."Biography", ''), d."Biography", ''),
                coalesce(nullif(a."PhotoUrl", ''), d."PhotoUrl", ''),
                coalesce(nullif(a."Nationality", ''), d."Nationality", ''),
                least(a."CreatedAtUtc", d."CreatedAtUtc"), greatest(a."UpdatedAtUtc", d."UpdatedAtUtc"),
                coalesce(a."IsDeleted", true) AND coalesce(d."IsDeleted", true)
            FROM "Actors" a FULL JOIN "Directors" d ON a."TmdbId" > 0 AND a."TmdbId" = d."TmdbId";

            CREATE TABLE "MovieCredits" (
                "Id" uuid CONSTRAINT "PK_MovieCredits" PRIMARY KEY,
                "MovieId" uuid NOT NULL CONSTRAINT "FK_MovieCredits_Movies_MovieId" REFERENCES "Movies" ("Id") ON DELETE CASCADE,
                "PersonId" uuid NOT NULL CONSTRAINT "FK_MovieCredits_People_PersonId" REFERENCES "People" ("Id") ON DELETE CASCADE,
                "Kind" text NOT NULL, "Department" text NOT NULL, "Job" text NOT NULL,
                "CharacterName" text, "Order" integer NOT NULL, "TmdbCreditId" text
            );
            CREATE INDEX "IX_MovieCredits_PersonId" ON "MovieCredits" ("PersonId");
            CREATE UNIQUE INDEX "IX_MovieCredits_MovieId_TmdbCreditId" ON "MovieCredits" ("MovieId", "TmdbCreditId");

            INSERT INTO "MovieCredits" ("Id", "MovieId", "PersonId", "Kind", "Department", "Job", "CharacterName", "Order")
            SELECT gen_random_uuid(), ma."MovieId", p."Id", 'Cast', 'Acting', 'Actor', ma."CharacterName", ma."Order"
            FROM "MovieActors" ma JOIN "People" p ON p."LegacyActorId" = ma."ActorId"
            UNION ALL
            SELECT gen_random_uuid(), md."MovieId", p."Id", 'Crew', 'Directing', 'Director', NULL, md."Order"
            FROM "MovieDirectors" md JOIN "People" p ON p."LegacyDirectorId" = md."DirectorId";

            DO $verify$
            BEGIN
                IF (SELECT count(*) FROM "People" WHERE "LegacyActorId" IS NOT NULL) <> (SELECT count(*) FROM "Actors")
                   OR (SELECT count(*) FROM "People" WHERE "LegacyDirectorId" IS NOT NULL) <> (SELECT count(*) FROM "Directors")
                   OR (SELECT count(*) FROM "MovieCredits" WHERE "Kind" = 'Cast') <> (SELECT count(*) FROM "MovieActors")
                   OR (SELECT count(*) FROM "MovieCredits" WHERE "Kind" = 'Crew') <> (SELECT count(*) FROM "MovieDirectors")
                THEN RAISE EXCEPTION 'Person or credit count mismatch during legacy backfill';
                END IF;
            END;
            $verify$;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "MovieCredits");
        migrationBuilder.DropTable(name: "People");
    }
}
