using MediatR;
using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common.Exceptions;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Application.DTOs;
namespace UFMDb.Application.Features.Movies.GetMovieDetail;
public record GetMovieDetailQuery(Guid MovieId, Guid? CurrentUserId) : IRequest<MovieDetailDto>;
public class GetMovieDetailQueryHandler : IRequestHandler<GetMovieDetailQuery, MovieDetailDto>
{
    private readonly IApplicationDbContext _context;
    public GetMovieDetailQueryHandler(IApplicationDbContext context) => _context = context;
    public async Task<MovieDetailDto> Handle(GetMovieDetailQuery request, CancellationToken ct)
    {
        var movie = await _context.Movies
            .AsNoTracking()
            .Include(m => m.MovieGenres).ThenInclude(mg => mg.Genre)
            .Include(m => m.MovieActors.OrderBy(ma => ma.Order)).ThenInclude(ma => ma.Actor)
            .Include(m => m.MovieDirectors).ThenInclude(md => md.Director)
            .FirstOrDefaultAsync(m => m.Id == request.MovieId && !m.IsDeleted, ct);
        if (movie is null) throw new NotFoundException(nameof(Domain.Entities.Movie), request.MovieId);
        bool isLiked = false, isInWatchlist = false, isWatched = false;
        decimal? myRating = null;
        MyReviewDto? myReview = null;
        if (request.CurrentUserId is Guid uid)
        {
            isLiked = await _context.Likes.AsNoTracking().AnyAsync(l => l.MovieId == movie.Id && l.UserId == uid, ct);
            isInWatchlist = await _context.WatchlistItems.AsNoTracking().AnyAsync(w => w.MovieId == movie.Id && w.UserId == uid, ct);
            isWatched = await _context.WatchHistory.AsNoTracking().AnyAsync(w => w.MovieId == movie.Id && w.UserId == uid, ct);

            var latestRatedEntry = await _context.WatchHistory.AsNoTracking()
                .Where(w => w.MovieId == movie.Id && w.UserId == uid && w.Rating != null)
                .OrderByDescending(w => w.WatchedAtUtc)
                .FirstOrDefaultAsync(ct);
            myRating = await _context.MovieRatings.AsNoTracking()
                .Where(r => r.MovieId == movie.Id && r.UserId == uid)
                .Select(r => (decimal?)r.Value)
                .FirstOrDefaultAsync(ct);

            var reviewEntity = await _context.Reviews.AsNoTracking()
                .FirstOrDefaultAsync(r => r.MovieId == movie.Id && r.UserId == uid && !r.IsDeleted, ct);
            if (reviewEntity is not null)
                myReview = new MyReviewDto(reviewEntity.Content, reviewEntity.ContainsSpoiler);
        }
        return new MovieDetailDto(
            movie.Id, movie.Title, movie.OriginalTitle, movie.Overview, movie.ReleaseYear, movie.ReleaseDate,
            movie.RuntimeMinutes, movie.PosterUrl, movie.BackdropUrl,
            movie.MovieDirectors.OrderBy(md => md.Order)
            .Select(md => new MovieDirectorDto(md.DirectorId, md.Director.FullName, md.Director.PhotoUrl)).ToList(),
            movie.Country, movie.AverageRating, movie.RatingCount, movie.LikeCount,
            movie.MovieGenres.Select(mg => mg.Genre.Name).ToList(),
            movie.MovieGenres.Select(mg => mg.GenreId).ToList(),
            movie.MovieActors.Select(ma => new MovieCastDto(ma.ActorId, ma.Actor.FullName, ma.Actor.PhotoUrl, ma.CharacterName, ma.Order)).ToList(),
            isLiked, isInWatchlist, isWatched, myRating, myReview
        );
    }
}