using MediatR;
using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Application.Common.Services;
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
        try
        {
            // Kullanıcı giriş yapmışsa watchlist ve like'ladığı film ID'lerini tek sorguda çekiyoruz.
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
            var baseQuery = _context.Movies.AsNoTracking().Where(m => !m.IsDeleted);

            // "C" — az oylu filmleri bu genel ortalamaya doğru çekiyoruz.
            var globalAverage = await BayesianRating.GetGlobalAverageAsync(
                baseQuery.Where(m => m.RatingCount > 0), ct);
            const int m0 = BayesianRating.MinVotesForRanking;

            // featured: ağırlıklı puan + beğeni sayısını birlikte kullanıyor, tek oyla
            // ekrana çıkan bir film artık öne çıkamaz (WR genel ortalamaya çok yakın kalır).
            var featured = await baseQuery
                .Where(m => m.RatingCount > 0)
                .OrderByDescending(m =>
                    (((double)m.RatingCount / (m.RatingCount + m0)) * m.AverageRating
                     + ((double)m0 / (m.RatingCount + m0)) * globalAverage) * 1000 + m.LikeCount)
                .Take(6).Select(MapToListItemProjection()).ToListAsync(ct);

            var popular = await baseQuery.OrderByDescending(m => m.LikeCount).Take(12).Select(MapToListItemProjection()).ToListAsync(ct);

            // topRated: artık saf AverageRating değil, IMDb tarzı ağırlıklı puana (WR) göre sıralanıyor.
            var topRated = await baseQuery
                .Where(m => m.RatingCount > 0)
                .OrderByDescending(m =>
                    ((double)m.RatingCount / (m.RatingCount + m0)) * m.AverageRating
                    + ((double)m0 / (m.RatingCount + m0)) * globalAverage)
                .Take(12).Select(MapToListItemProjection()).ToListAsync(ct);

            var trending = await baseQuery
                .OrderByDescending(m => m.ViewCount * 0.6 + m.LikeCount * 0.4)
                .Take(12).Select(MapToListItemProjection()).ToListAsync(ct);
            // EF Core'un projeksiyon içinde HashSet.Contains ile SQL üretemediği durumlar için,
            // bayrakları sorgu sonrası bellek üzerinde set ediyoruz (film sayısı zaten sınırlı).
            ApplyFlags(featured, watchlistMovieIds, likedMovieIds);
            ApplyFlags(popular, watchlistMovieIds, likedMovieIds);
            ApplyFlags(topRated, watchlistMovieIds, likedMovieIds);
            ApplyFlags(trending, watchlistMovieIds, likedMovieIds);
            return new HomeFeedDto(featured, popular, topRated, trending);
        }
        catch (Exception ex)
        {
            // TEMP - teşhis sonrası kaldır
            throw new Exception($"[DIAG] HomeFeed failed: {ex.GetType().FullName}: {ex.Message} | Inner: {ex.InnerException?.Message}", ex);
        }

    }
    private static void ApplyFlags(List<MovieListItemDto> items, HashSet<Guid> watchlistMovieIds, HashSet<Guid> likedMovieIds)
    {
        for (int i = 0; i < items.Count; i++)
        {
            items[i] = items[i] with
            {
                IsInWatchlistByCurrentUser = watchlistMovieIds.Contains(items[i].Id),
                IsLikedByCurrentUser = likedMovieIds.Contains(items[i].Id)
            };
        }
    }
    private static System.Linq.Expressions.Expression<Func<Domain.Entities.Movie, MovieListItemDto>> MapToListItemProjection() =>
    m => new MovieListItemDto(
        m.Id, m.Title, m.ReleaseYear, m.PosterUrl, (decimal)m.AverageRating, m.RatingCount,
        m.MovieGenres.Select(mg => mg.Genre.Name).ToList(), m.BackdropUrl, m.Overview,
        false, false, m.ReleaseDate);
}