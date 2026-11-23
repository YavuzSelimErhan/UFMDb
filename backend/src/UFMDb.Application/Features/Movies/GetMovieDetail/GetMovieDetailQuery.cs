using MediatR;
using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common;
using UFMDb.Application.Common.Exceptions;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Application.DTOs;
using UFMDb.Domain.Enums;
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
            .Include(m => m.MovieActors.OrderBy(ma => ma.Order)).ThenInclude(ma => ma.Actor)
            .Include(m => m.MovieDirectors).ThenInclude(md => md.Director)
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

        var actorIds = movie.MovieActors.Select(c => c.ActorId).ToArray();
        var directorIds = movie.MovieDirectors.Select(c => c.DirectorId).ToArray();
        var identities = await _context.People.AsNoTracking()
            .Where(p => !p.IsDeleted && ((p.LegacyActorId.HasValue && actorIds.Contains(p.LegacyActorId.Value))
                || (p.LegacyDirectorId.HasValue && directorIds.Contains(p.LegacyDirectorId.Value))))
            .Select(p => new { p.Id, p.LegacyActorId, p.LegacyDirectorId }).ToListAsync(ct);
        var actors = identities.Where(p => p.LegacyActorId.HasValue).ToDictionary(p => p.LegacyActorId!.Value, p => (Guid?)p.Id);
        var directors = identities.Where(p => p.LegacyDirectorId.HasValue).ToDictionary(p => p.LegacyDirectorId!.Value, p => (Guid?)p.Id);

        var crew = await (from credit in _context.MovieCredits.AsNoTracking()
                          join person in _context.People on credit.PersonId equals person.Id
                          where credit.MovieId == movie.Id && credit.Kind == UFMDb.Domain.Entities.CreditKind.Crew
                                && credit.Job != "Director" && !person.IsDeleted
                          select new { PersonId = person.Id, person.FullName, credit.Job, person.PhotoUrl, DirectorId = person.LegacyDirectorId })
            .Distinct()
            .OrderBy(c => c.Job).ThenBy(c => c.FullName).ThenBy(c => c.PersonId)
            .Select(c => new MovieCrewDto(c.PersonId, c.FullName, c.Job, c.PhotoUrl, c.DirectorId))
            .ToListAsync(ct);

        return new MovieDetailDto(
            movie.Id,
            Localization.Pick(isTr, movie.Title, movie.TitleTr),
            movie.OriginalTitle,
            Localization.Pick(isTr, movie.Overview, movie.OverviewTr),
            movie.ReleaseYear, movie.ReleaseDate,
            movie.RuntimeMinutes, movie.PosterUrl, movie.BackdropUrl,
            movie.MovieDirectors.OrderBy(md => md.Order)
                .Select(md => new MovieDirectorDto(md.DirectorId, md.Director.FullName, md.Director.PhotoUrl, directors.GetValueOrDefault(md.DirectorId))).ToList(),
            primaryCountry, movie.AverageRating, movie.RatingCount, movie.LikeCount,
            movie.MovieGenres.Select(mg => Localization.Pick(isTr, mg.Genre.Name, mg.Genre.NameTr)).ToList(),
            movie.MovieGenres.Select(mg => mg.GenreId).ToList(),
            movie.MovieActors.Select(ma => new MovieCastDto(ma.ActorId, ma.Actor.FullName, ma.Actor.PhotoUrl, ma.CharacterName, ma.Order, actors.GetValueOrDefault(ma.ActorId))).ToList(),
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