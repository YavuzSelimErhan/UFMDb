using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace UFMDb.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AverageRatingToDoublePrecision : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<double>(
                name: "AverageRating",
                table: "Movies",
                type: "double precision",
                nullable: false,
                oldClrType: typeof(double),
                oldType: "numeric(3,2)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<double>(
                name: "AverageRating",
                table: "Movies",
                type: "numeric(3,2)",
                nullable: false,
                oldClrType: typeof(double),
                oldType: "double precision");
        }
    }
}
