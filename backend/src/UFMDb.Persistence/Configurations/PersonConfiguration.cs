using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using UFMDb.Domain.Entities;

namespace UFMDb.Persistence.Configurations;

public class PersonConfiguration : IEntityTypeConfiguration<Person>
{
    public void Configure(EntityTypeBuilder<Person> b)
    {
        b.ToTable("People");
        b.Property(p => p.FullName).HasMaxLength(200);
        b.HasIndex(p => p.FullName);
        b.HasIndex(p => p.TmdbId).IsUnique().HasFilter("\"TmdbId\" IS NOT NULL");
        b.HasIndex(p => p.LegacyActorId).IsUnique();
        b.HasIndex(p => p.LegacyDirectorId).IsUnique();
        b.HasOne<Actor>().WithMany().HasForeignKey(p => p.LegacyActorId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne<Director>().WithMany().HasForeignKey(p => p.LegacyDirectorId).OnDelete(DeleteBehavior.SetNull);
    }
}

public class MovieCreditConfiguration : IEntityTypeConfiguration<MovieCredit>
{
    public void Configure(EntityTypeBuilder<MovieCredit> b)
    {
        b.ToTable("MovieCredits");
        b.Property(c => c.Kind).HasConversion<string>();
        b.HasOne<Movie>().WithMany().HasForeignKey(c => c.MovieId);
        b.HasOne<Person>().WithMany().HasForeignKey(c => c.PersonId);
        b.HasIndex(c => new { c.MovieId, c.TmdbCreditId }).IsUnique();
    }
}
