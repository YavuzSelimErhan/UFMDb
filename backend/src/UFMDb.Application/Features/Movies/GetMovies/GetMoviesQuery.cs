using MediatR;
using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Application.Common.Services;
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

        var releaseDateFromUtc = f.ReleaseDateFrom.HasValue
            ? DateTime.SpecifyKind(f.ReleaseDateFrom.Value, DateTimeKind.Utc)
            : (DateTime?)null;
        var releaseDateToUtc = f.ReleaseDateTo.HasValue
            ? DateTime.SpecifyKind(f.ReleaseDateTo.Value, DateTimeKind.Utc)
            : (DateTime?)null;

        if (!string.IsNullOrWhiteSpace(f.Title))
        {
            var titlePattern = $"%{f.Title}%";
            query = query.Where(m =>
                EF.Functions.ILike(m.Title, titlePattern) ||
                EF.Functions.ILike(m.OriginalTitle, titlePattern));
        }

        if (!string.IsNullOrWhiteSpace(f.Genre))
            query = query.Where(m => m.MovieGenres.Any(mg => mg.Genre.Name == f.Genre || mg.Genre.NameTr == f.Genre));

        if (!string.IsNullOrWhiteSpace(f.Country))
        {
            var countryMatch = await _context.Countries.AsNoTracking()
                .FirstOrDefaultAsync(c => c.Name == f.Country || c.NameTr == f.Country, ct);
            var resolvedCountry = countryMatch?.Name ?? f.Country;
            query = query.Where(m => m.Country == resolvedCountry);
        }

        if (f.YearFrom.HasValue)
            query = query.Where(m => m.ReleaseYear >= f.YearFrom.Value);
        if (f.YearTo.HasValue)
            query = query.Where(m => m.ReleaseYear <= f.YearTo.Value);
        if (f.YearFrom is null && f.YearTo is null && f.Year.HasValue)
            query = query.Where(m => m.ReleaseYear == f.Year.Value);

        if (releaseDateFromUtc.HasValue)
            query = query.Where(m => m.ReleaseDate >= releaseDateFromUtc.Value);
        if (releaseDateToUtc.HasValue)
            query = query.Where(m => m.ReleaseDate <= releaseDateToUtc.Value);

        if (!string.IsNullOrWhiteSpace(f.ActorName))
        {
            var actorPattern = $"%{f.ActorName}%";
            query = query.Where(m => m.MovieActors.Any(ma => EF.Functions.ILike(ma.Actor.FullName, actorPattern)));
        }

        if (!string.IsNullOrWhiteSpace(f.DirectorName))
        {
            var directorPattern = $"%{f.DirectorName}%";
            query = query.Where(m => m.MovieDirectors.Any(md => EF.Functions.ILike(md.Director.FullName, directorPattern)));
        }

        if (f.MinRating.HasValue)
            query = query.Where(m => m.AverageRating >= f.MinRating.Value);

        var isDescending = !string.Equals(f.SortDirection, "asc", StringComparison.OrdinalIgnoreCase);

        // "rating" sýralamasý sadece istendiðinde genel ortalamayý ("C") hesaplýyoruz —
        // diðer sortBy deðerlerinde gereksiz bir ek sorguya girmesin.
        double globalAverage = 0;
        if (f.SortBy == "rating")
        {
            globalAverage = await BayesianRating.GetGlobalAverageAsync(
                _context.Movies.AsNoTracking().Where(m => !m.IsDeleted && m.RatingCount > 0), ct);
        }
        const int m0 = BayesianRating.MinVotesForRanking;

        query = (f.SortBy, isDescending) switch
        {
            // Artýk saf AverageRating deðil, IMDb tarzý aðýrlýklý puana (WR) göre sýralanýyor —
            // az oylu filmler genel ortalamaya çekiliyor, aramadan/listeden kaybolmuyorlar,
            // sadece tepede çýkamýyorlar.
            ("rating", true) => query.OrderByDescending(m =>
                ((double)m.RatingCount / (m.RatingCount + m0)) * m.AverageRating
                + ((double)m0 / (m.RatingCount + m0)) * globalAverage),
            ("rating", false) => query.OrderBy(m =>
                ((double)m.RatingCount / (m.RatingCount + m0)) * m.AverageRating
                + ((double)m0 / (m.RatingCount + m0)) * globalAverage),
            ("year", true) => query.OrderByDescending(m => m.ReleaseYear),
            ("year", false) => query.OrderBy(m => m.ReleaseYear),
            ("popularity", true) => query.OrderByDescending(m => m.RatingCount).ThenByDescending(m => m.AverageRating),
            ("popularity", false) => query.OrderBy(m => m.RatingCount).ThenBy(m => m.AverageRating),
            ("newest", true) => query.OrderByDescending(m => m.CreatedAtUtc),
            ("newest", false) => query.OrderBy(m => m.CreatedAtUtc),
            ("releaseDate", true) => query.OrderByDescending(m => m.ReleaseDate),
            ("releaseDate", false) => query.OrderBy(m => m.ReleaseDate),
            (_, true) => query.OrderByDescending(m => m.Title),
            _ => query.OrderBy(m => m.Title)
        };

        var totalCount = await query.CountAsync(ct);
        var items = await query
            .Skip((f.Page - 1) * f.PageSize)
            .Take(f.PageSize)
            .Select(m => new MovieListItemDto(
                m.Id, m.Title, m.ReleaseYear, m.PosterUrl, (decimal)m.AverageRating, m.RatingCount,
                m.MovieGenres.Select(mg => mg.Genre.Name).ToList(), m.BackdropUrl, m.Overview,
                false, false, m.ReleaseDate
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