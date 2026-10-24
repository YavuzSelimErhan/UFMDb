using System.Linq.Expressions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Application.DTOs;
using UFMDb.Domain.Entities;
namespace UFMDb.Application.Features.Movies.GetMovies;

public record GetMoviesQuery(MovieSearchQueryDto Filter, Guid? UserId, string Lang = "en") : IRequest<PagedResult<MovieListItemDto>>;

public class GetMoviesQueryHandler : IRequestHandler<GetMoviesQuery, PagedResult<MovieListItemDto>>
{
    private readonly IApplicationDbContext _context;
    public GetMoviesQueryHandler(IApplicationDbContext context) => _context = context;

    private static IQueryable<MovieListItemDto> ProjectToListItem(IQueryable<Movie> source, bool isTr) =>
        source.Select(MovieProjections.ListItem(isTr));

    public async Task<PagedResult<MovieListItemDto>> Handle(GetMoviesQuery request, CancellationToken ct)
    {
        var f = request.Filter;
        var isTr = Localization.IsTurkish(request.Lang);
        var page = Math.Max(1, f.Page);
        var pageSize = Math.Clamp(f.PageSize, 1, 100);
        var query = _context.Movies.AsNoTracking().Where(m => !m.IsDeleted);

        var releaseDateFromUtc = f.ReleaseDateFrom.HasValue
            ? DateTime.SpecifyKind(f.ReleaseDateFrom.Value, DateTimeKind.Utc)
            : (DateTime?)null;
        var releaseDateToUtc = f.ReleaseDateTo.HasValue
            ? DateTime.SpecifyKind(f.ReleaseDateTo.Value, DateTimeKind.Utc)
            : (DateTime?)null;

        var hasTitleSearch = !string.IsNullOrWhiteSpace(f.Title);
        var term = SqlLike.Escape(f.Title?.Trim() ?? string.Empty);
        var containsPattern = $"%{term}%";
        var startsPattern = $"{term}%";

        if (hasTitleSearch)
        {
            // Dilden baðýmsýz: Ýngilizce, orijinal ve Türkçe baþlýklarýn hepsinde aranýr.
            query = query.Where(m =>
                EF.Functions.ILike(m.Title, containsPattern) ||
                EF.Functions.ILike(m.OriginalTitle, containsPattern) ||
                EF.Functions.ILike(m.TitleTr, containsPattern));
        }

        if (!string.IsNullOrWhiteSpace(f.Genre))
            query = query.Where(m => m.MovieGenres.Any(mg => mg.Genre.Name == f.Genre || mg.Genre.NameTr == f.Genre));

        if (!string.IsNullOrWhiteSpace(f.Country))
        {
            var countryMatch = await _context.Countries.AsNoTracking()
                .FirstOrDefaultAsync(c => c.Name == f.Country || c.NameTr == f.Country, ct);
            var resolvedCountry = countryMatch?.Name ?? f.Country;
            query = query.Where(m => m.Country == resolvedCountry
                || m.MovieCountries.Any(mc => mc.Country.Name == resolvedCountry));
        }

        if (!string.IsNullOrWhiteSpace(f.Keyword))
            query = query.Where(m => m.MovieKeywords.Any(mk => mk.Keyword.Name == f.Keyword));

        if (f.CollectionId.HasValue)
            query = query.Where(m => m.CollectionId == f.CollectionId.Value);

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
            var actorPattern = $"%{SqlLike.Escape(f.ActorName.Trim())}%";
            query = query.Where(m => m.MovieActors.Any(ma => EF.Functions.ILike(ma.Actor.FullName, actorPattern)));
        }

        if (!string.IsNullOrWhiteSpace(f.DirectorName))
        {
            var directorPattern = $"%{SqlLike.Escape(f.DirectorName.Trim())}%";
            query = query.Where(m => m.MovieDirectors.Any(md => EF.Functions.ILike(md.Director.FullName, directorPattern)));
        }

        if (f.MinRating.HasValue)
            query = query.Where(m => m.AverageRating >= f.MinRating.Value);

        var isDescending = !string.Equals(f.SortDirection, "asc", StringComparison.OrdinalIgnoreCase);

        List<MovieListItemDto> items;
        int totalCount;

        if (f.SortBy == "rating")
        {
            // Bayesian aðýrlýklý puan: WR = (v*R + m*C) / (v + m)
            //   v = RatingCount, R = AverageRating, m = RatingRankPolicy.MinVotesForRatingRank,
            //   C = filtrelenmiþ listenin ortalama puaný.
            // Skor SQL'de hesaplanýyor; sadece sayfanýn film id'leri çekiliyor.
            //
            // NOT: AverageRating artýk double precision kolon (decimal(3,2) overflow hatasý giderildi).
            // Yine de tip karýþýmý olmasýn diye global ortalama nullable double, m*C önceden tek
            // double ve RatingCount açýkça double'a çevrilerek hesaplanýyor.
            var minVotes = Math.Max(1.0, (double)RatingRankPolicy.MinVotesForRatingRank);

            totalCount = await query.CountAsync(ct);

            double globalMean = 0.0;
            if (totalCount > 0)
            {
                var avg = await query.Select(m => (double?)m.AverageRating).AverageAsync(ct);
                globalMean = avg ?? 0.0;
            }
            var priorWeight = minVotes * globalMean;

            var scored = query.Select(m => new
            {
                m.Id,
                m.RatingCount,
                Score = ((double)m.RatingCount * m.AverageRating + priorWeight) / ((double)m.RatingCount + minVotes),
                // Baþlýk aramasýnda alaka düzeyi her zaman önce gelir, puan katman içinde uygulanýr.
                Relevance = !hasTitleSearch ? 2 :
                    (EF.Functions.ILike(m.Title, term) || EF.Functions.ILike(m.OriginalTitle, term) || EF.Functions.ILike(m.TitleTr, term)) ? 0 :
                    (EF.Functions.ILike(m.Title, startsPattern) || EF.Functions.ILike(m.OriginalTitle, startsPattern) || EF.Functions.ILike(m.TitleTr, startsPattern)) ? 1 : 2
            });

            var ordered = scored.OrderBy(x => x.Relevance);
            var sorted = isDescending
                ? ordered.ThenByDescending(x => x.Score).ThenByDescending(x => x.RatingCount).ThenBy(x => x.Id)
                : ordered.ThenBy(x => x.Score).ThenBy(x => x.RatingCount).ThenBy(x => x.Id);

            var pageIds = await sorted
                .Skip((page - 1) * pageSize).Take(pageSize)
                .Select(x => x.Id)
                .ToListAsync(ct);

            var loaded = await ProjectToListItem(
                    _context.Movies.AsNoTracking().Where(m => pageIds.Contains(m.Id)), isTr)
                .ToListAsync(ct);
            var loadedById = loaded.ToDictionary(x => x.Id);
            items = pageIds.Where(loadedById.ContainsKey).Select(id => loadedById[id]).ToList();
        }
        else
        {
            // Sýralama seçenekleri:
            //   popularity : TMDB'nin güncel popülerlik skoru (yeni/konuþulan filmler öne çýkar) -> "Trend"
            //   votes      : toplam oy sayýsý (TMDB oylarý + site oylarý)                        -> "Popüler (tüm zamanlar)"
            if (hasTitleSearch)
            {
                // Alaka düzeyi popülerlikten önce gelir: "ran" aratýldýðýnda "Ran" filmi, içinde "ran"
                // geçen daha çok oy almýþ filmlerin gerisinde kalýp listeden düþmesin.
                Expression<Func<Movie, int>> relevance = m =>
                    (EF.Functions.ILike(m.Title, term) || EF.Functions.ILike(m.OriginalTitle, term) || EF.Functions.ILike(m.TitleTr, term)) ? 0 :
                    (EF.Functions.ILike(m.Title, startsPattern) || EF.Functions.ILike(m.OriginalTitle, startsPattern) || EF.Functions.ILike(m.TitleTr, startsPattern)) ? 1 : 2;

                var ordered = query.OrderBy(relevance);

                query = (f.SortBy, isDescending) switch
                {
                    ("year", true) => ordered.ThenByDescending(m => m.ReleaseYear),
                    ("year", false) => ordered.ThenBy(m => m.ReleaseYear),
                    ("popularity", true) => ordered.ThenByDescending(m => m.TmdbPopularity).ThenByDescending(m => m.RatingCount),
                    ("popularity", false) => ordered.ThenBy(m => m.TmdbPopularity).ThenBy(m => m.RatingCount),
                    ("votes", true) => ordered.ThenByDescending(m => m.RatingCount).ThenByDescending(m => m.TmdbPopularity),
                    ("votes", false) => ordered.ThenBy(m => m.RatingCount).ThenBy(m => m.TmdbPopularity),
                    ("newest", true) => ordered.ThenByDescending(m => m.CreatedAtUtc),
                    ("newest", false) => ordered.ThenBy(m => m.CreatedAtUtc),
                    ("releaseDate", true) => ordered.ThenByDescending(m => m.ReleaseDate),
                    ("releaseDate", false) => ordered.ThenBy(m => m.ReleaseDate),
                    (_, true) => ordered.ThenByDescending(m => isTr && m.TitleTr != "" ? m.TitleTr : m.Title),
                    _ => ordered.ThenBy(m => isTr && m.TitleTr != "" ? m.TitleTr : m.Title)
                };
            }
            else
            {
                query = (f.SortBy, isDescending) switch
                {
                    ("year", true) => query.OrderByDescending(m => m.ReleaseYear),
                    ("year", false) => query.OrderBy(m => m.ReleaseYear),
                    ("popularity", true) => query.OrderByDescending(m => m.TmdbPopularity).ThenByDescending(m => m.RatingCount),
                    ("popularity", false) => query.OrderBy(m => m.TmdbPopularity).ThenBy(m => m.RatingCount),
                    ("votes", true) => query.OrderByDescending(m => m.RatingCount).ThenByDescending(m => m.TmdbPopularity),
                    ("votes", false) => query.OrderBy(m => m.RatingCount).ThenBy(m => m.TmdbPopularity),
                    ("newest", true) => query.OrderByDescending(m => m.CreatedAtUtc),
                    ("newest", false) => query.OrderBy(m => m.CreatedAtUtc),
                    ("releaseDate", true) => query.OrderByDescending(m => m.ReleaseDate),
                    ("releaseDate", false) => query.OrderBy(m => m.ReleaseDate),
                    (_, true) => query.OrderByDescending(m => isTr && m.TitleTr != "" ? m.TitleTr : m.Title),
                    _ => query.OrderBy(m => isTr && m.TitleTr != "" ? m.TitleTr : m.Title)
                };
            }

            totalCount = await query.CountAsync(ct);
            items = await ProjectToListItem(
                    query.Skip((page - 1) * pageSize).Take(pageSize), isTr)
                .ToListAsync(ct);
        }

        if (request.UserId.HasValue)
            items = await MovieUserFlags.ApplyAsync(_context, items, request.UserId.Value, ct);

        return new PagedResult<MovieListItemDto>(items, totalCount, page, pageSize);
    }
}