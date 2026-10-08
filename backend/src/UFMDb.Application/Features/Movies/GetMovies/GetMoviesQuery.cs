using MediatR;
using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Application.DTOs;
namespace UFMDb.Application.Features.Movies.GetMovies;

public record GetMoviesQuery(MovieSearchQueryDto Filter, Guid? UserId) : IRequest<PagedResult<MovieListItemDto>>;

public class GetMoviesQueryHandler : IRequestHandler<GetMoviesQuery, PagedResult<MovieListItemDto>>
{
    private readonly IApplicationDbContext _context;
    public GetMoviesQueryHandler(IApplicationDbContext context) => _context = context;

    // "rating" sýralamasý için hafif projeksiyon: sadece sýralamaya yetecek düz sütunlar.
    private sealed record RatingRow(Guid Id, int RatingCount, double AverageRating, int Relevance);

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
        var hasTitleSearch = !string.IsNullOrWhiteSpace(f.Title);

        List<MovieListItemDto> items;
        int totalCount;

        if (f.SortBy == "rating")
        {
            // Bayesian aðýrlýklý puan: WR = (v*R + m*C) / (v + m)
            //   v = RatingCount, R = AverageRating, m = RatingRankPolicy.MinVotesForRatingRank,
            //   C = mevcut filtrelenmiþ listenin ortalama puaný.
            // Sýralama SQL'e yazýlmýyor: düz sütunlar çekilip bellekte sýralanýyor, sadece sayfadaki
            // film id'leriyle asýl veri yükleniyor. Az oylu filmler gizlenmez, sadece aþaðýda kalýr.
            var minVotes = Math.Max(1.0, (double)RatingRankPolicy.MinVotesForRatingRank);

            List<RatingRow> rows;
            if (hasTitleSearch)
            {
                var term = f.Title!.Trim();
                var startsPattern = $"{term}%";
                rows = await query.Select(m => new RatingRow(
                    m.Id, m.RatingCount, m.AverageRating,
                    (EF.Functions.ILike(m.Title, term) || EF.Functions.ILike(m.OriginalTitle, term)) ? 0 :
                    (EF.Functions.ILike(m.Title, startsPattern) || EF.Functions.ILike(m.OriginalTitle, startsPattern)) ? 1 :
                    2)).ToListAsync(ct);
            }
            else
            {
                rows = await query.Select(m => new RatingRow(m.Id, m.RatingCount, m.AverageRating, 0)).ToListAsync(ct);
            }

            totalCount = rows.Count;
            var globalMean = rows.Count > 0 ? rows.Average(r => r.AverageRating) : 0.0;
            double Score(RatingRow r) => (r.RatingCount * r.AverageRating + minVotes * globalMean) / (r.RatingCount + minVotes);

            // Baþlýk aramasýnda alaka düzeyi her zaman önce gelir, puan katman içinde uygulanýr.
            var ordered = rows.OrderBy(r => r.Relevance);
            var sorted = isDescending
                ? ordered.ThenByDescending(Score).ThenByDescending(r => r.RatingCount).ThenBy(r => r.Id)
                : ordered.ThenBy(Score).ThenBy(r => r.RatingCount).ThenBy(r => r.Id);

            var pageIds = sorted.Skip((f.Page - 1) * f.PageSize).Take(f.PageSize).Select(r => r.Id).ToList();

            var loaded = await _context.Movies.AsNoTracking()
                .Where(m => pageIds.Contains(m.Id))
                .Select(m => new MovieListItemDto(
                    m.Id, m.Title, m.ReleaseYear, m.PosterUrl, (decimal)m.AverageRating, m.RatingCount,
                    m.MovieGenres.Select(mg => mg.Genre.Name).ToList(), m.BackdropUrl, m.Overview,
                    false, false, false, m.ReleaseDate))
                .ToListAsync(ct);
            var loadedById = loaded.ToDictionary(x => x.Id);
            items = pageIds.Where(loadedById.ContainsKey).Select(id => loadedById[id]).ToList();
        }
        else
        {
            if (hasTitleSearch)
            {
                // Baþlýkla arama yapýlýrken alaka düzeyi popülerlikten önce gelir: "ran" aratýldýðýnda
                // "Ran" filmi, içinde "ran" geçen daha çok oy almýþ baþka filmlerin (ör. "Strangers")
                // gerisinde kalýp listeden düþmesin. Katman içinde kullanýcýnýn seçtiði sýralama
                // (popülerlik/yýl/vb.) aþaðýda ThenBy olarak uygulanmaya devam ediyor.
                var term = f.Title!.Trim();
                var startsPattern = $"{term}%";

                var ordered = query.OrderBy(m =>
                    (EF.Functions.ILike(m.Title, term) || EF.Functions.ILike(m.OriginalTitle, term)) ? 0 :
                    (EF.Functions.ILike(m.Title, startsPattern) || EF.Functions.ILike(m.OriginalTitle, startsPattern)) ? 1 :
                    2);

                query = (f.SortBy, isDescending) switch
                {
                    ("year", true) => ordered.ThenByDescending(m => m.ReleaseYear),
                    ("year", false) => ordered.ThenBy(m => m.ReleaseYear),
                    ("popularity", true) => ordered.ThenByDescending(m => m.RatingCount).ThenByDescending(m => m.AverageRating),
                    ("popularity", false) => ordered.ThenBy(m => m.RatingCount).ThenBy(m => m.AverageRating),
                    ("newest", true) => ordered.ThenByDescending(m => m.CreatedAtUtc),
                    ("newest", false) => ordered.ThenBy(m => m.CreatedAtUtc),
                    ("releaseDate", true) => ordered.ThenByDescending(m => m.ReleaseDate),
                    ("releaseDate", false) => ordered.ThenBy(m => m.ReleaseDate),
                    (_, true) => ordered.ThenByDescending(m => m.Title),
                    _ => ordered.ThenBy(m => m.Title)
                };
            }
            else
            {
                query = (f.SortBy, isDescending) switch
                {
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
            }

            totalCount = await query.CountAsync(ct);
            items = await query
                .Skip((f.Page - 1) * f.PageSize)
                .Take(f.PageSize)
                .Select(m => new MovieListItemDto(
                    m.Id, m.Title, m.ReleaseYear, m.PosterUrl, (decimal)m.AverageRating, m.RatingCount,
                    m.MovieGenres.Select(mg => mg.Genre.Name).ToList(), m.BackdropUrl, m.Overview,
                    false, false, false, m.ReleaseDate
                ))
                .ToListAsync(ct);
        }

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

            var watchedIds = (await _context.WatchHistory.AsNoTracking()
                .Where(w => w.UserId == request.UserId.Value && movieIds.Contains(w.MovieId))
                .Select(w => w.MovieId)
                .ToListAsync(ct)).ToHashSet();

            for (int i = 0; i < items.Count; i++)
            {
                items[i] = items[i] with
                {
                    IsInWatchlistByCurrentUser = watchlistIds.Contains(items[i].Id),
                    IsLikedByCurrentUser = likedIds.Contains(items[i].Id),
                    IsWatchedByCurrentUser = watchedIds.Contains(items[i].Id)
                };
            }
        }

        return new PagedResult<MovieListItemDto>(items, totalCount, f.Page, f.PageSize);
    }
}