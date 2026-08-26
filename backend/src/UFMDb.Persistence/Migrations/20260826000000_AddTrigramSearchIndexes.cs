using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace UFMDb.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTrigramSearchIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // ILIKE '%...%' (leading wildcard) aramaları normal B-tree index'lerini
            // kullanamaz. pg_trgm + GIN index bu tür aramalarda sequential scan yerine
            // index scan yapılmasını sağlar (Actor/Director/Movie arama performansı).
            migrationBuilder.Sql(@"
                CREATE EXTENSION IF NOT EXISTS pg_trgm;

                CREATE INDEX IF NOT EXISTS ""IX_Actors_FullName_Trgm""
                    ON ""Actors"" USING gin (""FullName"" gin_trgm_ops);

                CREATE INDEX IF NOT EXISTS ""IX_Directors_FullName_Trgm""
                    ON ""Directors"" USING gin (""FullName"" gin_trgm_ops);

                CREATE INDEX IF NOT EXISTS ""IX_Movies_Title_Trgm""
                    ON ""Movies"" USING gin (""Title"" gin_trgm_ops);
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                DROP INDEX IF EXISTS ""IX_Movies_Title_Trgm"";
                DROP INDEX IF EXISTS ""IX_Directors_FullName_Trgm"";
                DROP INDEX IF EXISTS ""IX_Actors_FullName_Trgm"";
            ");
        }
    }
}