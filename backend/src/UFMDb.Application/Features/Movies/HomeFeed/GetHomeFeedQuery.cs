using MediatR;
using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Application.DTOs;
namespace UFMDb.Application.Features.Movies.HomeFeed;
public record HomeFeedDto(
    List<MovieListItemDto> Featured,
    List<MovieListItemDto> Popular,
    List<MovieListItemDto> TopRated,
    List<MovieListItemDto> Trending
);
// Misafir kullanıcılar da ana sayfayı görebildiği için UserId opsiyonel
public record GetHomeFeedQuery(Guid? UserId) : IRequest<HomeFeedDto>;
public class GetHomeFeedQueryHandler : IRequestHandler<GetHomeFeedQuery, HomeFeedDto>
{
    private readonly IApplicationDbContext _context;
    public GetHomeFeedQueryHandler(IApplicationDbContext context) => _context = context;
    public async Task<HomeFeedDto> Handle(GetHomeFeedQuery request, CancellationToken ct)
    {
        // Kullanıcı giriş yapmışsa watchlist, like ve izlediği film ID'lerini tek sorguda çekiyoruz.
        HashSet<Guid> watchlistMovieIds = request.UserId.HasValue
            ? (await _context.WatchlistItems.AsNoTracking()
                .Where(w => w.UserId == request.UserId.Value)
                .Select(w => w.MovieId)
                .ToListAsync(ct)).ToHashSet()
            : new HashSet<Guid>();
        HashSet<Guid> likedMovieIds = request.UserId.HasValue
            ? (await _context.Likes.AsNoTracking()
                .Where(l => l.UserId == request.UserId.Value)
                .Select(l => l.MovieId)
                .ToListAsync(ct)).ToHashSet()
            : new HashSet<Guid>();
        HashSet<Guid> watchedMovieIds = request.UserId.HasValue
            ? (await _context.WatchHistory.AsNoTracking()
                .Where(w => w.UserId == request.UserId.Value)
                .Select(w => w.MovieId)
                .ToListAsync(ct)).ToHashSet()
            : new HashSet<Guid>();
        var baseQuery = _context.Movies.AsNoTracking().Where(m => !m.IsDeleted);

        // Featured (ana sayfa hero carousel'i): KATI eşik korunuyor — az oylu, "şans eseri"
        // yüksek ortalamalı filmler burada hiç görünmesin. RatingRankPolicy.MinVotesForRatingRank
        // değerinin 1000 olduğundan emin olun.
        var featured = await baseQuery
            .Where(m => m.RatingCount >= RatingRankPolicy.MinVotesForRatingRank)
            .OrderByDescending(m => m.AverageRating * 1000 + m.LikeCount)
            .Take(6).Select(MapToListItemProjection()).ToListAsync(ct);

        var popular = await baseQuery.OrderByDescending(m => m.LikeCount).Take(12).Select(MapToListItemProjection()).ToListAsync(ct);

        // Top Rated: az oylu filmleri GİZLEMİYORUZ; IMDb tipi Bayesian ağırlıklı puanla sıralıyoruz:
        //   WR = (v*R + m*C) / (v + m)
        //   v = RatingCount, R = AverageRating, m = RatingRankPolicy.MinVotesForRatingRank,
        //   C = tüm katalogun ortalama puanı.
        // Sıralama SQL'e yazılmıyor (çeviri hatası riski yok): üç düz sütun çekilip puan bellekte
        // hesaplanıyor, sadece ilk 12 id ile asıl film verisi çekiliyor.
        var minVotes = Math.Max(1.0, (double)RatingRankPolicy.MinVotesForRatingRank);
        var rows = await baseQuery
            .Select(m => new { m.Id, m.RatingCount, m.AverageRating })
            .ToListAsync(ct);
        var globalMean = rows.Count > 0 ? rows.Average(r => r.AverageRating) : 0.0;

        var topIds = rows
            .OrderByDescending(r => (r.RatingCount * r.AverageRating + minVotes * globalMean) / (r.RatingCount + minVotes))
            .ThenByDescending(r => r.RatingCount)
            .Take(12)
            .Select(r => r.Id)
            .ToList();

        var topRatedUnordered = await baseQuery
            .Where(m => topIds.Contains(m.Id))
            .Select(MapToListItemProjection())
            .ToListAsync(ct);
        var topRatedById = topRatedUnordered.ToDictionary(x => x.Id);
        var topRated = topIds.Where(topRatedById.ContainsKey).Select(id => topRatedById[id]).ToList();

        var trending = await baseQuery
            .OrderByDescending(m => m.ViewCount * 0.6 + m.LikeCount * 0.4)
            .Take(12).Select(MapToListItemProjection()).ToListAsync(ct);
        // EF Core'un projeksiyon içinde HashSet.Contains ile SQL üretemediği durumlar için,
        // bayrakları sorgu sonrası bellek üzerinde set ediyoruz (film sayısı zaten sınırlı).
        ApplyFlags(featured, watchlistMovieIds, likedMovieIds, watchedMovieIds);
        ApplyFlags(popular, watchlistMovieIds, likedMovieIds, watchedMovieIds);
        ApplyFlags(topRated, watchlistMovieIds, likedMovieIds, watchedMovieIds);
        ApplyFlags(trending, watchlistMovieIds, likedMovieIds, watchedMovieIds);
        return new HomeFeedDto(featured, popular, topRated, trending);
    }
    private static void ApplyFlags(List<MovieListItemDto> items, HashSet<Guid> watchlistMovieIds, HashSet<Guid> likedMovieIds, HashSet<Guid> watchedMovieIds)
    {
        for (int i = 0; i < items.Count; i++)
        {
            items[i] = items[i] with
            {
                IsInWatchlistByCurrentUser = watchlistMovieIds.Contains(items[i].Id),
                IsLikedByCurrentUser = likedMovieIds.Contains(items[i].Id),
                IsWatchedByCurrentUser = watchedMovieIds.Contains(items[i].Id)
            };
        }
    }
    private static System.Linq.Expressions.Expression<Func<Domain.Entities.Movie, MovieListItemDto>> MapToListItemProjection() =>
    m => new MovieListItemDto(
        m.Id, m.Title, m.ReleaseYear, m.PosterUrl, (decimal)m.AverageRating, m.RatingCount,
        m.MovieGenres.Select(mg => mg.Genre.Name).ToList(), m.BackdropUrl, m.Overview,
        false, false, false, m.ReleaseDate);
}