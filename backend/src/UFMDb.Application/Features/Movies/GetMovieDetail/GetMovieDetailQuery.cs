using MediatR;
using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common;
using UFMDb.Application.Common.Exceptions;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Application.DTOs;
using UFMDb.Domain.Enums;
using CreditKind = UFMDb.Domain.Entities.CreditKind;
namespace UFMDb.Application.Features.Movies.GetMovieDetail;

public record GetMovieDetailQuery(Guid MovieId, Guid? CurrentUserId, string Lang = "en") : IRequest<MovieDetailDto>;

public class GetMovieDetailQueryHandler : IRequestHandler<GetMovieDetailQuery, MovieDetailDto>
{
    private readonly IApplicationDbContext _context;
    public GetMovieDetailQueryHandler(IApplicationDbContext context) => _context = context;

    public async Task<MovieDetailDto> Handle(GetMovieDetailQuery request, CancellationToken ct)
    {
        var isTr = Localization.IsTurkish(request.Lang);

        var movie = await _context.Movies
            .AsNoTracking()
            .Include(m => m.MovieGenres).ThenInclude(mg => mg.Genre)
            .Include(m => m.MovieCountries.OrderBy(mc => mc.Order)).ThenInclude(mc => mc.Country)
            .Include(m => m.MovieKeywords).ThenInclude(mk => mk.Keyword)
            .Include(m => m.MovieProductionCompanies).ThenInclude(pc => pc.ProductionCompany)
            .Include(m => m.Videos)
            .Include(m => m.Images)
            .Include(m => m.Collection)
            .AsSplitQuery()
            .FirstOrDefaultAsync(m => m.Id == request.MovieId && !m.IsDeleted, ct);

        if (movie is null) throw new NotFoundException(nameof(Domain.Entities.Movie), request.MovieId);

        bool isInWatchlist = false, isWatched = false;
        ReactionType? myReaction = null;
        decimal? myRating = null;
        MyReviewDto? myReview = null;

        if (request.CurrentUserId is Guid uid)
        {
            myReaction = await _context.Likes.AsNoTracking()
                .Where(l => l.MovieId == movie.Id && l.UserId == uid)
                .Select(l => (ReactionType?)l.Reaction)
                .FirstOrDefaultAsync(ct);
            isInWatchlist = await _context.WatchlistItems.AsNoTracking().AnyAsync(w => w.MovieId == movie.Id && w.UserId == uid, ct);

            myRating = await _context.MovieRatings.AsNoTracking()
                .Where(r => r.MovieId == movie.Id && r.UserId == uid)
                .Select(r => (decimal?)r.Value)
                .FirstOrDefaultAsync(ct);

            // "Ýzlenmiþ" = logu VEYA puaný olan film (profil ve Films listesiyle ayný taným)
            isWatched = myRating.HasValue
                || await _context.WatchHistory.AsNoTracking().AnyAsync(w => w.MovieId == movie.Id && w.UserId == uid, ct);

            var reviewEntity = await _context.Reviews.AsNoTracking()
                .FirstOrDefaultAsync(r => r.MovieId == movie.Id && r.UserId == uid && !r.IsDeleted, ct);
            if (reviewEntity is not null)
                myReview = new MyReviewDto(reviewEntity.Content, reviewEntity.ContainsSpoiler);
        }

        // ---- Koleksiyon (seri/üçleme) + serideki diðer filmler ----
        MovieCollectionDto? collectionDto = null;
        if (movie.Collection is { } col)
        {
            var siblings = await _context.Movies.AsNoTracking()
                .Where(m => m.CollectionId == col.Id && !m.IsDeleted && m.Id != movie.Id)
                .OrderBy(m => m.ReleaseDate)
                .Take(20)
                .Select(m => new CollectionMovieDto(
                    m.Id, isTr && m.TitleTr != "" ? m.TitleTr : m.Title, m.ReleaseYear, m.PosterUrl))
                .ToListAsync(ct);
            collectionDto = new MovieCollectionDto(col.Id, col.Name, col.PosterUrl, col.BackdropUrl, siblings);
        }

        var countries = movie.MovieCountries
            .OrderBy(mc => mc.Order)
            .Select(mc => new MovieCountryDto(mc.Country.IsoCode, Localization.Pick(isTr, mc.Country.Name, mc.Country.NameTr)))
            .ToList();
        var primaryCountry = countries.FirstOrDefault()?.Name ?? movie.Country;

        var videos = movie.Videos
            .OrderBy(v => v.Type == "Trailer" ? 0 : 1)
            .ThenByDescending(v => v.IsOfficial)
            .ThenByDescending(v => v.PublishedAtUtc)
            .Select(v => new MovieVideoDto(v.Key, v.Site, v.Type, v.Name, v.Language, v.IsOfficial))
            .ToList();

        var images = movie.Images
            .OrderBy(i => i.Type)
            .ThenByDescending(i => i.VoteAverage)
            .Select(i => new MovieImageDto(i.Type, i.FilePath, i.Language, i.Width, i.Height))
            .ToList();

        // ---- Oyuncular, yönetmenler, ekip: tek kredi sorgusu ----
        var creditRows = await (from credit in _context.MovieCredits.AsNoTracking()
                                join person in _context.People on credit.PersonId equals person.Id
                                where credit.MovieId == movie.Id && !person.IsDeleted
                                select new
                                {
                                    credit.Kind,
                                    credit.Job,
                                    credit.CharacterName,
                                    credit.Order,
                                    PersonId = person.Id,
                                    person.FullName,
                                    person.PhotoUrl
                                })
            .ToListAsync(ct);

        var cast = creditRows
            .Where(c => c.Kind == CreditKind.Cast)
            .GroupBy(c => c.PersonId)
            .Select(g =>
            {
                var ordered = g.OrderBy(c => c.Order).ToList();
                var first = ordered[0];
                var characters = string.Join(" / ", ordered
                    .Select(c => c.CharacterName)
                    .Where(n => !string.IsNullOrWhiteSpace(n))
                    .Distinct());
                return new MovieCastDto(g.Key, first.FullName, first.PhotoUrl, characters, first.Order);
            })
            .OrderBy(c => c.Order).ThenBy(c => c.FullName).ThenBy(c => c.PersonId)
            .ToList();

        var directors = creditRows
            .Where(c => c.Kind == CreditKind.Crew && c.Job == "Director")
            .GroupBy(c => c.PersonId)
            .Select(g => g.OrderBy(c => c.Order).First())
            .OrderBy(c => c.Order).ThenBy(c => c.FullName).ThenBy(c => c.PersonId)
            .Select(c => new MovieDirectorDto(c.PersonId, c.FullName, c.PhotoUrl))
            .ToList();

        var crew = creditRows
            .Where(c => c.Kind == CreditKind.Crew && c.Job != "Director")
            .Select(c => new MovieCrewDto(c.PersonId, c.FullName, c.Job, c.PhotoUrl))
            .Distinct()
            .OrderBy(c => c.Job).ThenBy(c => c.FullName).ThenBy(c => c.PersonId)
            .ToList();

        return new MovieDetailDto(
            movie.Id,
            Localization.Pick(isTr, movie.Title, movie.TitleTr),
            movie.OriginalTitle,
            Localization.Pick(isTr, movie.Overview, movie.OverviewTr),
            movie.ReleaseYear, movie.ReleaseDate,
            movie.RuntimeMinutes, movie.PosterUrl, movie.BackdropUrl,
            directors,
            primaryCountry, movie.AverageRating, movie.RatingCount, movie.LikeCount,
            movie.MovieGenres.Select(mg => Localization.Pick(isTr, mg.Genre.Name, mg.Genre.NameTr)).ToList(),
            movie.MovieGenres.Select(mg => mg.GenreId).ToList(),
            cast,
            myReaction == ReactionType.Like, isInWatchlist, isWatched, myRating, myReview,
            movie.DislikeCount, myReaction,
            Tagline: Localization.Pick(isTr, movie.Tagline, movie.TaglineTr),
            TrailerKey: movie.TrailerKey,
            Certification: movie.Certification,
            CertificationCountry: movie.CertificationCountry,
            ImdbId: movie.ImdbId,
            Homepage: movie.Homepage,
            OriginalLanguage: movie.OriginalLanguage,
            Budget: movie.Budget,
            Revenue: movie.Revenue,
            TmdbStatus: movie.TmdbStatus,
            Countries: countries,
            Keywords: movie.MovieKeywords.Select(mk => new KeywordDto(mk.KeywordId, mk.Keyword.Name))
                .OrderBy(k => k.Name).ToList(),
            Companies: movie.MovieProductionCompanies
                .Select(pc => new ProductionCompanyDto(pc.ProductionCompanyId, pc.ProductionCompany.Name,
                    pc.ProductionCompany.LogoPath, pc.ProductionCompany.OriginCountry))
                .OrderBy(c => c.Name).ToList(),
            Videos: videos,
            Images: images,
            Collection: collectionDto,
            Crew: crew
        );
    }
}