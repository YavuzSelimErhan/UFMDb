using MediatR;
using Microsoft.EntityFrameworkCore;
using UFMDb.Domain.Entities;

namespace UFMDb.Application.Common.Interfaces;

/// <summary>
/// Application katmanı, EF Core'a değil bu arayüze bağımlıdır.
/// Gerçek implementasyon Persistence katmanındaki ApplicationDbContext'tir.
/// Bu sayede Clean Architecture bağımlılık kuralı korunur.
/// </summary>
public interface IApplicationDbContext
{
    DbSet<Movie> Movies { get; }
    DbSet<Genre> Genres { get; }
    DbSet<MovieRating> MovieRatings { get; }
    DbSet<Country> Countries { get; }
    DbSet<Actor> Actors { get; }
    DbSet<MovieActor> MovieActors { get; }
    DbSet<Director> Directors { get; }
    DbSet<MovieDirector> MovieDirectors { get; }
    DbSet<User> Users { get; }
    DbSet<Review> Reviews { get; }
    DbSet<ReviewLike> ReviewLikes { get; }
    DbSet<Like> Likes { get; }
    DbSet<WatchlistItem> WatchlistItems { get; }
    DbSet<FavoriteMovie> FavoriteMovies { get; }
    DbSet<WatchHistory> WatchHistory { get; }
    DbSet<CuratedList> CuratedLists { get; }
    DbSet<CuratedListLike> CuratedListLikes { get; }
    DbSet<RefreshToken> RefreshTokens { get; }
    DbSet<PasswordResetToken> PasswordResetTokens { get; }
    DbSet<ActorLike> ActorLikes { get; }
    DbSet<FavoriteActor> FavoriteActors { get; }
    DbSet<DirectorLike> DirectorLikes { get; }
    DbSet<FavoriteDirector> FavoriteDirectors { get; }
    DbSet<Follow> Follows { get; }
    DbSet<Notification> Notifications { get; }
    DbSet<MovieVideo> MovieVideos { get; }
    DbSet<MovieImage> MovieImages { get; }
    DbSet<Keyword> Keywords { get; }
    DbSet<MovieKeyword> MovieKeywords { get; }
    DbSet<ProductionCompany> ProductionCompanies { get; }
    DbSet<MovieProductionCompany> MovieProductionCompanies { get; }
    DbSet<MovieCollection> MovieCollections { get; }
    DbSet<MovieCountry> MovieCountries { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
