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
    DbSet<Actor> Actors { get; }
    DbSet<MovieActor> MovieActors { get; }
    DbSet<Director> Directors { get; }
    DbSet<MovieDirector> MovieDirectors { get; }
    DbSet<User> Users { get; }
    DbSet<Review> Reviews { get; }
    DbSet<Like> Likes { get; }
    DbSet<WatchlistItem> WatchlistItems { get; }
    DbSet<FavoriteMovie> FavoriteMovies { get; }
    DbSet<WatchHistory> WatchHistory { get; }
    DbSet<CuratedList> CuratedLists { get; }
    DbSet<RefreshToken> RefreshTokens { get; }
    DbSet<ActorLike> ActorLikes { get; }
    DbSet<FavoriteActor> FavoriteActors { get; }
    DbSet<DirectorLike> DirectorLikes { get; }
    DbSet<FavoriteDirector> FavoriteDirectors { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
