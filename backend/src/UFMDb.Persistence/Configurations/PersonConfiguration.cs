using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using UFMDb.Domain.Entities;

namespace UFMDb.Persistence.Configurations;

public class PersonConfiguration : IEntityTypeConfiguration<Person>
{
    public void Configure(EntityTypeBuilder<Person> b)
    {
        b.ToTable("People");
        b.Property(p => p.FullName).IsRequired().HasMaxLength(200);
        b.Property(p => p.PhotoUrl).HasMaxLength(500);
        b.Property(p => p.Nationality).HasMaxLength(100);

        b.HasIndex(p => p.FullName);
        b.HasIndex(p => new { p.LikeCount, p.FullName });
        b.HasIndex(p => p.TmdbId).IsUnique().HasFilter("\"TmdbId\" IS NOT NULL");
        b.HasIndex(p => p.LegacyActorId).IsUnique().HasFilter("\"LegacyActorId\" IS NOT NULL");
        b.HasIndex(p => p.LegacyDirectorId).IsUnique().HasFilter("\"LegacyDirectorId\" IS NOT NULL");
    }
}

public class MovieCreditConfiguration : IEntityTypeConfiguration<MovieCredit>
{
    public void Configure(EntityTypeBuilder<MovieCredit> b)
    {
        b.ToTable("MovieCredits");
        b.HasKey(c => c.Id);

        // DB'de zaten metin olarak duruyor ("Cast"/"Crew"); projedeki diðer enum'larla ayný yaklaþým.
        b.Property(c => c.Kind).HasConversion<string>().HasMaxLength(10);

        b.Property(c => c.Department).HasMaxLength(50);
        b.Property(c => c.Job).HasMaxLength(100);
        b.Property(c => c.CharacterName).HasMaxLength(500);
        b.Property(c => c.TmdbCreditId).HasMaxLength(50);

        b.HasOne(c => c.Movie).WithMany(m => m.Credits).HasForeignKey(c => c.MovieId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(c => c.Person).WithMany(p => p.Credits).HasForeignKey(c => c.PersonId).OnDelete(DeleteBehavior.Cascade);

        // Sync sýrasýnda upsert anahtarý
        b.HasIndex(c => c.TmdbCreditId).IsUnique().HasFilter("\"TmdbCreditId\" IS NOT NULL");
        // Film sayfasý: cast/crew sýralý liste
        b.HasIndex(c => new { c.MovieId, c.Kind, c.Order });
        // Kiþi sayfasý: filmografi (PersonId önde olduðu için tek baþýna PersonId sorgusunu da karþýlar)
        b.HasIndex(c => new { c.PersonId, c.MovieId });
        // "Yönetmen" rol filtresi (GetPeople role=director) ve yönetmen aramalarý için kýsmi index
        b.HasIndex(c => c.PersonId)
            .HasFilter("\"Kind\" = 'Crew' AND \"Job\" = 'Director'")
            .HasDatabaseName("IX_MovieCredits_Directors_PersonId");

        // "Oyuncu" rol filtresi için aynýsý
        b.HasIndex(c => c.PersonId)
            .HasFilter("\"Kind\" = 'Cast'")
            .HasDatabaseName("IX_MovieCredits_Cast_PersonId");
    }
}

public class PersonLikeConfiguration : IEntityTypeConfiguration<PersonLike>
{
    public void Configure(EntityTypeBuilder<PersonLike> b)
    {
        b.ToTable("PersonLikes");
        b.HasIndex(l => new { l.PersonId, l.UserId }).IsUnique();
        b.HasOne(l => l.Person).WithMany(p => p.PersonLikes).HasForeignKey(l => l.PersonId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(l => l.User).WithMany().HasForeignKey(l => l.UserId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class FavoritePersonConfiguration : IEntityTypeConfiguration<FavoritePerson>
{
    public void Configure(EntityTypeBuilder<FavoritePerson> b)
    {
        b.ToTable("FavoritePeople");
        b.Property(f => f.Role).HasConversion<string>().HasMaxLength(10);
        b.HasKey(f => new { f.UserId, f.Role, f.Slot });
        b.HasOne(f => f.User).WithMany().HasForeignKey(f => f.UserId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(f => f.Person).WithMany(p => p.FavoritePeople).HasForeignKey(f => f.PersonId).OnDelete(DeleteBehavior.Restrict);
        b.HasIndex(f => f.PersonId);
        b.HasIndex(f => new { f.UserId, f.Role, f.PersonId }).IsUnique();
    }
}