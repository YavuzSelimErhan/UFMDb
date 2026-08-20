using MediatR;
using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Application.DTOs;
namespace UFMDb.Application.Features.Movies.GetMovies;

public record GetMoviesQuery(MovieSearchQueryDto Filter, Guid? UserId) : IRequest<PagedResult<MovieListItemDto>>;

public class GetMoviesQueryHandler : IRequestHandler<GetMoviesQuery, PagedResult<MovieListItemDto>>
{
    private readonly IApplicationDbContext _context;
    public GetMoviesQueryHandler(IApplicationDbContext context) => _context = context;

    public async Task<PagedResult<MovieListItemDto>> Handle(GetMoviesQuery request, CancellationToken ct)
    {
        var f = request.Filter;
        var query = _context.Movies.AsNoTracking().Where(m => !m.IsDeleted);

        if (!string.IsNullOrWhiteSpace(f.Title))
            query = query.Where(m => m.Title.Contains(f.Title) || m.OriginalTitle.Contains(f.Title));
        if (!string.IsNullOrWhiteSpace(f.Genre))
            query = query.Where(m => m.MovieGenres.Any(mg => mg.Genre.Name == f.Genre || mg.Genre.NameTr == f.Genre));

        if (f.YearFrom.HasValue || f.YearTo.HasValue)
        {
            if (f.YearFrom.HasValue) query = query.Where(m => m.ReleaseYear >= f.YearFrom.Value);
            if (f.YearTo.HasValue) query = query.Where(m => m.ReleaseYear <= f.YearTo.Value);
        }
        else if (f.Year.HasValue)
        {
            query = query.Where(m => m.ReleaseYear == f.Year.Value);
        }

        if (!string.IsNullOrWhiteSpace(f.ActorName))
            query = query.Where(m => m.MovieActors.Any(ma => ma.Actor.FullName.Contains(f.ActorName)));
        if (!string.IsNullOrWhiteSpace(f.DirectorName))
            query = query.Where(m => m.MovieDirectors.Any(md => md.Director.FullName.Contains(f.DirectorName)));
        if (f.MinRating.HasValue)
            query = query.Where(m => m.AverageRating >= f.MinRating.Value);

        var isDescending = !string.Equals(f.SortDirection, "asc", StringComparison.OrdinalIgnoreCase);
        query = (f.SortBy, isDescending) switch
        {
            ("rating", true) => query.OrderByDescending(m => m.AverageRating),
            ("rating", false) => query.OrderBy(m => m.AverageRating),
            ("year", true) => query.OrderByDescending(m => m.ReleaseYear),
            ("year", false) => query.OrderBy(m => m.ReleaseYear),
            ("popularity", true) => query.OrderByDescending(m => m.RatingCount).ThenByDescending(m => m.AverageRating),
            ("popularity", false) => query.OrderBy(m => m.RatingCount).ThenBy(m => m.AverageRating),
            ("newest", true) => query.OrderByDescending(m => m.CreatedAtUtc),
            ("newest", false) => query.OrderBy(m => m.CreatedAtUtc),
            (_, true) => query.OrderByDescending(m => m.Title),
            _ => query.OrderBy(m => m.Title)
        };

        var totalCount = await query.CountAsync(ct);
        var items = await query
            .Skip((f.Page - 1) * f.PageSize)
            .Take(f.PageSize)
            .Select(m => new MovieListItemDto(
                m.Id, m.Title, m.ReleaseYear, m.PosterUrl, m.AverageRating, m.RatingCount,
                m.MovieGenres.Select(mg => mg.Genre.Name).ToList(), m.BackdropUrl, m.Overview,
                false, false
            ))
            .ToListAsync(ct);

        if (request.UserId.HasValue && items.Count > 0)
        {
            var movieIds = items.Select(i => i.Id).ToHashSet();

            var watchlistIds = (await _context.WatchlistItems.AsNoTracking()
                .Where(w => w.UserId == request.UserId.Value && movieIds.Contains(w.MovieId))
                .Select(w => w.MovieId)
                .ToListAsync(ct)).ToHashSet();

            var likedIds = (await _context.Likes.AsNoTracking()
                .Where(l => l.UserId == request.UserId.Value && movieIds.Contains(l.MovieId))
                .Select(l => l.MovieId)
                .ToListAsync(ct)).ToHashSet();

            for (int i = 0; i < items.Count; i++)
            {
                items[i] = items[i] with
                {
                    IsInWatchlistByCurrentUser = watchlistIds.Contains(items[i].Id),
                    IsLikedByCurrentUser = likedIds.Contains(items[i].Id)
                };
            }
        }

        return new PagedResult<MovieListItemDto>(items, totalCount, f.Page, f.PageSize);
    }
}