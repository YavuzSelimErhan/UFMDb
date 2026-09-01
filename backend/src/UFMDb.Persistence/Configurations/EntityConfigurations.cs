using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using UFMDb.Domain.Entities;

namespace UFMDb.Persistence.Configurations;

public class MovieConfiguration : IEntityTypeConfiguration<Movie>
{
    public void Configure(EntityTypeBuilder<Movie> b)
    {
        b.ToTable("Movies");
        b.Property(m => m.Title).IsRequired().HasMaxLength(300);
        b.Property(m => m.OriginalTitle).HasMaxLength(300);
        b.Property(m => m.Overview).HasMaxLength(4000);
        b.Property(m => m.PosterUrl).HasMaxLength(500);
        b.Property(m => m.BackdropUrl).HasMaxLength(500);
        b.Property(m => m.AverageRating).HasColumnType("decimal(3,2)");

        // Enum'u DB'de okunabilir string olarak sakla (int yerine) — migration sonrası
        // veritabanına bakıldığında "Upcoming"/"Stable" görmek int'ten daha az hataya açık.
        b.Property(m => m.LifecycleStatus)
            .HasConversion<string>()
            .HasMaxLength(20);

        b.HasIndex(m => m.Title);
        b.HasIndex(m => m.ReleaseYear);
        b.HasIndex(m => m.TmdbId).IsUnique().HasFilter("\"TmdbId\" IS NOT NULL");
        b.HasIndex(m => m.ReleaseDate);
        b.HasIndex(m => new { m.RatingCount, m.AverageRating });
        b.HasIndex(m => m.CreatedAtUtc);

        // refresh-released ve refresh-post-release job'larının WHERE LifecycleStatus = ... AND ReleaseDate ...
        // sorgularını hızlandırmak için bileşik index.
        b.HasIndex(m => new { m.LifecycleStatus, m.ReleaseDate });
    }
}

public class GenreConfiguration : IEntityTypeConfiguration<Genre>
{
    public void Configure(EntityTypeBuilder<Genre> b)
    {
        b.ToTable("Genres");
        b.Property(g => g.Name).IsRequired().HasMaxLength(100);
        b.HasIndex(g => g.Name).IsUnique();
        b.HasIndex(g => g.TmdbId).IsUnique().HasFilter("\"TmdbId\" IS NOT NULL");
    }
}

public class MovieGenreConfiguration : IEntityTypeConfiguration<MovieGenre>
{
    public void Configure(EntityTypeBuilder<MovieGenre> b)
    {
        b.ToTable("MovieGenres");
        b.HasKey(mg => new { mg.MovieId, mg.GenreId });
        b.HasOne(mg => mg.Movie).WithMany(m => m.MovieGenres).HasForeignKey(mg => mg.MovieId);
        b.HasOne(mg => mg.Genre).WithMany(g => g.MovieGenres).HasForeignKey(mg => mg.GenreId);
    }
}

public class ActorConfiguration : IEntityTypeConfiguration<Actor>
{
    public void Configure(EntityTypeBuilder<Actor> b)
    {
        b.ToTable("Actors");
        b.Property(a => a.FullName).IsRequired().HasMaxLength(200);
        b.HasIndex(a => a.FullName);
        b.HasIndex(a => a.TmdbId).IsUnique().HasFilter("\"TmdbId\" IS NOT NULL");
    }
}

public class MovieActorConfiguration : IEntityTypeConfiguration<MovieActor>
{
    public void Configure(EntityTypeBuilder<MovieActor> b)
    {
        b.ToTable("MovieActors");
        b.HasKey(ma => new { ma.MovieId, ma.ActorId });
        b.Property(ma => ma.CharacterName).HasMaxLength(200);
        b.HasOne(ma => ma.Movie).WithMany(m => m.MovieActors).HasForeignKey(ma => ma.MovieId);
        b.HasOne(ma => ma.Actor).WithMany(a => a.MovieActors).HasForeignKey(ma => ma.ActorId);
    }
}

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> b)
    {
        b.ToTable("Users");
        b.Property(u => u.UserName).IsRequired().HasMaxLength(50);
        b.Property(u => u.Email).IsRequired().HasMaxLength(256);
        b.HasIndex(u => u.Email).IsUnique();
        b.HasIndex(u => u.UserName).IsUnique();
        b.Property(u => u.FullName).HasMaxLength(100);
        b.Property(u => u.Country).HasMaxLength(100);
        b.Property(u => u.Biography).HasMaxLength(500);
    }
}

public class ReviewConfiguration : IEntityTypeConfiguration<Review>
{
    public void Configure(EntityTypeBuilder<Review> b)
    {
        b.ToTable("Reviews");
        b.Property(r => r.Content).HasMaxLength(5000);
        b.HasIndex(r => new { r.MovieId, r.UserId }).IsUnique();
        b.HasOne(r => r.Movie).WithMany(m => m.Reviews).HasForeignKey(r => r.MovieId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(r => r.User).WithMany(u => u.Reviews).HasForeignKey(r => r.UserId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class ReviewLikeConfiguration : IEntityTypeConfiguration<ReviewLike>
{
    public void Configure(EntityTypeBuilder<ReviewLike> builder)
    {
        builder.HasIndex(rl => new { rl.ReviewId, rl.UserId }).IsUnique();

        builder.HasOne(rl => rl.Review)
            .WithMany(r => r.Likes)
            .HasForeignKey(rl => rl.ReviewId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(rl => rl.User)
            .WithMany()
            .HasForeignKey(rl => rl.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class LikeConfiguration : IEntityTypeConfiguration<Like>
{
    public void Configure(EntityTypeBuilder<Like> b)
    {
        b.ToTable("Likes");
        b.HasIndex(l => new { l.MovieId, l.UserId }).IsUnique();
        b.HasOne(l => l.Movie).WithMany(m => m.Likes).HasForeignKey(l => l.MovieId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(l => l.User).WithMany(u => u.Likes).HasForeignKey(l => l.UserId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class WatchlistItemConfiguration : IEntityTypeConfiguration<WatchlistItem>
{
    public void Configure(EntityTypeBuilder<WatchlistItem> b)
    {
        b.ToTable("WatchlistItems");
        b.HasIndex(w => new { w.MovieId, w.UserId }).IsUnique();
        b.HasOne(w => w.Movie).WithMany(m => m.WatchlistItems).HasForeignKey(w => w.MovieId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(w => w.User).WithMany(u => u.WatchlistItems).HasForeignKey(w => w.UserId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class FavoriteMovieConfiguration : IEntityTypeConfiguration<FavoriteMovie>
{
    public void Configure(EntityTypeBuilder<FavoriteMovie> b)
    {
        b.ToTable("FavoriteMovies");
        b.HasKey(f => new { f.UserId, f.Slot });
        b.HasOne(f => f.User).WithMany(u => u.FavoriteMovies).HasForeignKey(f => f.UserId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(f => f.Movie).WithMany().HasForeignKey(f => f.MovieId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class MovieRatingConfiguration : IEntityTypeConfiguration<MovieRating>
{
    public void Configure(EntityTypeBuilder<MovieRating> b)
    {
        b.ToTable("MovieRatings");
        b.Property(r => r.Value).HasColumnType("decimal(2,1)");
        b.HasIndex(r => new { r.MovieId, r.UserId }).IsUnique();
        b.HasOne(r => r.Movie).WithMany(m => m.MovieRatings).HasForeignKey(r => r.MovieId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(r => r.User).WithMany(u => u.MovieRatings).HasForeignKey(r => r.UserId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class WatchHistoryConfiguration : IEntityTypeConfiguration<WatchHistory>
{
    public void Configure(EntityTypeBuilder<WatchHistory> b)
    {
        b.ToTable("WatchHistory");
        b.Property(w => w.Rating).HasColumnType("decimal(2,1)");
        b.HasOne(w => w.User).WithMany(u => u.WatchHistory).HasForeignKey(w => w.UserId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(w => w.Movie).WithMany().HasForeignKey(w => w.MovieId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class CuratedListConfiguration : IEntityTypeConfiguration<CuratedList>
{
    public void Configure(EntityTypeBuilder<CuratedList> b)
    {
        b.ToTable("CuratedLists");
        b.Property(c => c.Title).IsRequired().HasMaxLength(200);

        b.HasOne(c => c.CreatedByUser)
            .WithMany(u => u.CreatedLists)
            .HasForeignKey(c => c.CreatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        // "Resmi koleksiyonlar" / "Topluluk listeleri" filtresi ve profil sayfasındaki
        // "kullanıcının listeleri" sorgusu için.
        b.HasIndex(c => c.IsOfficial);
        b.HasIndex(c => c.CreatedByUserId);
    }
}

public class CuratedListItemConfiguration : IEntityTypeConfiguration<CuratedListItem>
{
    public void Configure(EntityTypeBuilder<CuratedListItem> b)
    {
        b.ToTable("CuratedListItems");
        b.HasKey(i => new { i.CuratedListId, i.MovieId });
        b.HasOne(i => i.CuratedList).WithMany(c => c.Items).HasForeignKey(i => i.CuratedListId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(i => i.Movie).WithMany().HasForeignKey(i => i.MovieId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class CuratedListLikeConfiguration : IEntityTypeConfiguration<CuratedListLike>
{
    public void Configure(EntityTypeBuilder<CuratedListLike> b)
    {
        b.ToTable("CuratedListLikes");
        b.HasIndex(l => new { l.CuratedListId, l.UserId }).IsUnique();
        b.HasOne(l => l.CuratedList).WithMany(c => c.Likes).HasForeignKey(l => l.CuratedListId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(l => l.User).WithMany(u => u.CuratedListLikes).HasForeignKey(l => l.UserId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class RefreshTokenConfiguration : IEntityTypeConfiguration<RefreshToken>
{
    public void Configure(EntityTypeBuilder<RefreshToken> b)
    {
        b.ToTable("RefreshTokens");
        b.Property(r => r.Token).IsRequired().HasMaxLength(200);
        b.HasOne(r => r.User).WithMany(u => u.RefreshTokens).HasForeignKey(r => r.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class ActorLikeConfiguration : IEntityTypeConfiguration<ActorLike>
{
    public void Configure(EntityTypeBuilder<ActorLike> b)
    {
        b.ToTable("ActorLikes");
        b.HasIndex(l => new { l.ActorId, l.UserId }).IsUnique();
        b.HasOne(l => l.Actor).WithMany(a => a.ActorLikes).HasForeignKey(l => l.ActorId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(l => l.User).WithMany(u => u.ActorLikes).HasForeignKey(l => l.UserId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class FavoriteActorConfiguration : IEntityTypeConfiguration<FavoriteActor>
{
    public void Configure(EntityTypeBuilder<FavoriteActor> b)
    {
        b.ToTable("FavoriteActors");
        b.HasKey(f => new { f.UserId, f.Slot });
        b.HasOne(f => f.User).WithMany(u => u.FavoriteActors).HasForeignKey(f => f.UserId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(f => f.Actor).WithMany().HasForeignKey(f => f.ActorId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class DirectorConfiguration : IEntityTypeConfiguration<Director>
{
    public void Configure(EntityTypeBuilder<Director> b)
    {
        b.ToTable("Directors");
        b.Property(d => d.FullName).IsRequired().HasMaxLength(200);
        b.HasIndex(d => d.FullName);
        b.HasIndex(d => d.TmdbId).IsUnique().HasFilter("\"TmdbId\" IS NOT NULL");
    }
}

public class MovieDirectorConfiguration : IEntityTypeConfiguration<MovieDirector>
{
    public void Configure(EntityTypeBuilder<MovieDirector> b)
    {
        b.ToTable("MovieDirectors");
        b.HasKey(md => new { md.MovieId, md.DirectorId });
        b.HasOne(md => md.Movie).WithMany(m => m.MovieDirectors).HasForeignKey(md => md.MovieId);
        b.HasOne(md => md.Director).WithMany(d => d.MovieDirectors).HasForeignKey(md => md.DirectorId);
    }
}

public class DirectorLikeConfiguration : IEntityTypeConfiguration<DirectorLike>
{
    public void Configure(EntityTypeBuilder<DirectorLike> b)
    {
        b.ToTable("DirectorLikes");
        b.HasIndex(l => new { l.DirectorId, l.UserId }).IsUnique();
        b.HasOne(l => l.Director).WithMany(d => d.DirectorLikes).HasForeignKey(l => l.DirectorId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(l => l.User).WithMany(u => u.DirectorLikes).HasForeignKey(l => l.UserId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class FavoriteDirectorConfiguration : IEntityTypeConfiguration<FavoriteDirector>
{
    public void Configure(EntityTypeBuilder<FavoriteDirector> b)
    {
        b.ToTable("FavoriteDirectors");
        b.HasKey(f => new { f.UserId, f.Slot });
        b.HasOne(f => f.User).WithMany(u => u.FavoriteDirectors).HasForeignKey(f => f.UserId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(f => f.Director).WithMany(d => d.FavoriteDirectors).HasForeignKey(f => f.DirectorId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class FollowConfiguration : IEntityTypeConfiguration<Follow>
{
    public void Configure(EntityTypeBuilder<Follow> builder)
    {
        // Aynı kullanıcıyı iki kere takip edemez
        builder.HasIndex(f => new { f.FollowerId, f.FollowingId }).IsUnique();

        builder.HasOne(f => f.Follower)
            .WithMany(u => u.Following)
            .HasForeignKey(f => f.FollowerId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(f => f.Following)
            .WithMany(u => u.Followers)
            .HasForeignKey(f => f.FollowingId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}