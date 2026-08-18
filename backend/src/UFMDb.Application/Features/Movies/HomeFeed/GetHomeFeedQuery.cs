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
        // Kullanıcı giriş yapmışsa watchlist'indeki film ID'lerini tek sorguda çekiyoruz.
        // Her film için ayrı ayrı sorgu atmak yerine bir HashSet'te tutup mapping sırasında kontrol ediyoruz.
        HashSet<Guid> watchlistMovieIds = request.UserId.HasValue
            ? (await _context.WatchlistItems.AsNoTracking()
                .Where(w => w.UserId == request.UserId.Value)
                .Select(w => w.MovieId)
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
                    i.Movie.AverageRating, i.Movie.RatingCount,
                    i.Movie.MovieGenres.Select(mg => mg.Genre.Name).ToList(),
                    i.Movie.BackdropUrl, i.Movie.Overview,
                    false // curated list mapping'inde watchlist bilgisi ayrıca doldurulacak (aşağıda)
                )).ToList()
            )).ToListAsync(ct);

        // EF Core'un projeksiyon içinde HashSet.Contains ile SQL üretemediği durumlar için,
        // watchlist bayrağını sorgu sonrası bellek üzerinde set ediyoruz (film sayısı zaten sınırlı: 6+12*3+curated).
        ApplyWatchlistFlag(featured, watchlistMovieIds);
        ApplyWatchlistFlag(popular, watchlistMovieIds);
        ApplyWatchlistFlag(topRated, watchlistMovieIds);
        ApplyWatchlistFlag(trending, watchlistMovieIds);
        foreach (var cl in curatedLists) ApplyWatchlistFlag(cl.Movies, watchlistMovieIds);

        return new HomeFeedDto(featured, popular, topRated, trending, curatedLists);
    }

    private static void ApplyWatchlistFlag(List<MovieListItemDto> items, HashSet<Guid> watchlistMovieIds)
    {
        for (int i = 0; i < items.Count; i++)
        {
            if (watchlistMovieIds.Contains(items[i].Id))
                items[i] = items[i] with { IsInWatchlistByCurrentUser = true };
        }
    }

    private static System.Linq.Expressions.Expression<Func<Domain.Entities.Movie, MovieListItemDto>> MapToListItemProjection() =>
        m => new MovieListItemDto(
            m.Id, m.Title, m.ReleaseYear, m.PosterUrl, m.AverageRating, m.RatingCount,
            m.MovieGenres.Select(mg => mg.Genre.Name).ToList(), m.BackdropUrl, m.Overview,
            false);
}