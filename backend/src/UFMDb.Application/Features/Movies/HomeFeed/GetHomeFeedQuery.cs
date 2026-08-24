using MediatR;
using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Application.DTOs;
namespace UFMDb.Application.Features.Movies.HomeFeed;

public record CuratedListDto(Guid Id, string Title, string TitleTr, List<MovieListItemDto> Movies);
public record HomeFeedDto(
    List<MovieListItemDto> Featured,
    List<MovieListItemDto> Popular,
    List<MovieListItemDto> TopRated,
    List<MovieListItemDto> Trending,
    List<CuratedListDto> CuratedLists
);

// Misafir kullanıcılar da ana sayfayı görebildiği için UserId opsiyonel
public record GetHomeFeedQuery(Guid? UserId) : IRequest<HomeFeedDto>;

public class GetHomeFeedQueryHandler : IRequestHandler<GetHomeFeedQuery, HomeFeedDto>
{
    private readonly IApplicationDbContext _context;
    public GetHomeFeedQueryHandler(IApplicationDbContext context) => _context = context;

    public async Task<HomeFeedDto> Handle(GetHomeFeedQuery request, CancellationToken ct)
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

        var featured = await baseQuery
            .Where(m => m.RatingCount > 0)
            .OrderByDescending(m => m.AverageRating * 1000 + m.LikeCount)
            .Take(6).Select(MapToListItemProjection()).ToListAsync(ct);

        var popular = await baseQuery.OrderByDescending(m => m.LikeCount).Take(12).Select(MapToListItemProjection()).ToListAsync(ct);

        var topRated = await baseQuery.Where(m => m.RatingCount > 0)
            .OrderByDescending(m => m.AverageRating).Take(12).Select(MapToListItemProjection()).ToListAsync(ct);

        var trending = await baseQuery
            .OrderByDescending(m => m.ViewCount * 0.6 + m.LikeCount * 0.4)
            .Take(12).Select(MapToListItemProjection()).ToListAsync(ct);

        var curatedLists = await _context.CuratedLists.AsNoTracking()
            .OrderBy(cl => cl.DisplayOrder)
            .Select(cl => new CuratedListDto(
                cl.Id,
                cl.Title,
                cl.TitleTr,
                cl.Items.OrderBy(i => i.Order).Select(i => new MovieListItemDto(
                    i.Movie.Id, i.Movie.Title, i.Movie.ReleaseYear, i.Movie.PosterUrl,
                    (decimal)i.Movie.AverageRating, i.Movie.RatingCount,
                    i.Movie.MovieGenres.Select(mg => mg.Genre.Name).ToList(),
                    i.Movie.BackdropUrl, i.Movie.Overview,
                    false, false, i.Movie.ReleaseDate
                )).ToList()
            )).ToListAsync(ct);

        // EF Core'un projeksiyon içinde HashSet.Contains ile SQL üretemediği durumlar için,
        // bayrakları sorgu sonrası bellek üzerinde set ediyoruz (film sayısı zaten sınırlı).
        ApplyFlags(featured, watchlistMovieIds, likedMovieIds);
        ApplyFlags(popular, watchlistMovieIds, likedMovieIds);
        ApplyFlags(topRated, watchlistMovieIds, likedMovieIds);
        ApplyFlags(trending, watchlistMovieIds, likedMovieIds);
        foreach (var cl in curatedLists) ApplyFlags(cl.Movies, watchlistMovieIds, likedMovieIds);

        return new HomeFeedDto(featured, popular, topRated, trending, curatedLists);
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