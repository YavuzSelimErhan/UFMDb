using System.Diagnostics.Metrics;
using System.Reflection;
using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Domain.Common;
using UFMDb.Domain.Entities;

namespace UFMDb.Persistence;

public class ApplicationDbContext : DbContext, IApplicationDbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) { }

    public DbSet<Person> People => Set<Person>();
    public DbSet<MovieCredit> MovieCredits => Set<MovieCredit>();
    public DbSet<PersonLike> PersonLikes => Set<PersonLike>();
    public DbSet<FavoritePerson> FavoritePeople => Set<FavoritePerson>();
    public DbSet<Movie> Movies => Set<Movie>();
    public DbSet<Genre> Genres => Set<Genre>();
    public DbSet<MovieRating> MovieRatings => Set<MovieRating>();
    public DbSet<Country> Countries => Set<Country>();
    public DbSet<Actor> Actors => Set<Actor>();
    public DbSet<MovieActor> MovieActors => Set<MovieActor>();
    public DbSet<Director> Directors => Set<Director>();
    public DbSet<MovieDirector> MovieDirectors => Set<MovieDirector>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Review> Reviews => Set<Review>();
    public DbSet<ReviewLike> ReviewLikes => Set<ReviewLike>();
    public DbSet<Like> Likes => Set<Like>();
    public DbSet<WatchlistItem> WatchlistItems => Set<WatchlistItem>();
    public DbSet<FavoriteMovie> FavoriteMovies => Set<FavoriteMovie>();
    public DbSet<WatchHistory> WatchHistory => Set<WatchHistory>();
    public DbSet<CuratedList> CuratedLists => Set<CuratedList>();
    public DbSet<CuratedListLike> CuratedListLikes => Set<CuratedListLike>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();
    public DbSet<ActorLike> ActorLikes => Set<ActorLike>();
    public DbSet<FavoriteActor> FavoriteActors => Set<FavoriteActor>();
    public DbSet<DirectorLike> DirectorLikes => Set<DirectorLike>();
    public DbSet<FavoriteDirector> FavoriteDirectors => Set<FavoriteDirector>();
    public DbSet<Follow> Follows => Set<Follow>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<MovieVideo> MovieVideos => Set<MovieVideo>();
    public DbSet<MovieImage> MovieImages => Set<MovieImage>();
    public DbSet<Keyword> Keywords => Set<Keyword>();
    public DbSet<MovieKeyword> MovieKeywords => Set<MovieKeyword>();
    public DbSet<ProductionCompany> ProductionCompanies => Set<ProductionCompany>();
    public DbSet<MovieProductionCompany> MovieProductionCompanies => Set<MovieProductionCompany>();
    public DbSet<MovieCollection> MovieCollections => Set<MovieCollection>();
    public DbSet<MovieCountry> MovieCountries => Set<MovieCountry>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        // Aksan duyarsız arama için (EF.Functions.Unaccent)
        builder.HasPostgresExtension("unaccent");

        builder.ApplyConfigurationsFromAssembly(Assembly.GetExecutingAssembly());

        // Global soft-delete query filter (BaseEntity'den türeyen tüm tipler için)
        foreach (var entityType in builder.Model.GetEntityTypes())
        {
            if (typeof(BaseEntity).IsAssignableFrom(entityType.ClrType))
            {
                var parameter = System.Linq.Expressions.Expression.Parameter(entityType.ClrType, "e");
                var property = System.Linq.Expressions.Expression.Property(parameter, nameof(BaseEntity.IsDeleted));
                var condition = System.Linq.Expressions.Expression.Equal(property, System.Linq.Expressions.Expression.Constant(false));
                var lambda = System.Linq.Expressions.Expression.Lambda(condition, parameter);
                builder.Entity(entityType.ClrType).HasQueryFilter(lambda);
            }
        }

        base.OnModelCreating(builder);
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        foreach (var entry in ChangeTracker.Entries<BaseEntity>())
        {
            if (entry.State == EntityState.Modified)
                entry.Entity.UpdatedAtUtc = DateTime.UtcNow;
        }
        return base.SaveChangesAsync(cancellationToken);
    }
}