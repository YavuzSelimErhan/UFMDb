using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common.Exceptions;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Application.Common.Services;
using UFMDb.Domain.Entities;

namespace UFMDb.Application.Features.Movies.ManageMovie;

// ---------- CREATE ----------
public record CreateMovieCommand(
    string Title, string OriginalTitle, string Overview, int ReleaseYear, DateTime ReleaseDate,
    int RuntimeMinutes, string PosterUrl, string BackdropUrl, List<Guid> DirectorIds, string Country,
    List<Guid> GenreIds, List<CastMemberInput> Cast, double SeedRating
) : IRequest<Guid>;

public class CreateMovieCommandValidator : AbstractValidator<CreateMovieCommand>
{
    public CreateMovieCommandValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(300);
        RuleFor(x => x.ReleaseYear).InclusiveBetween(1888, DateTime.UtcNow.Year + 5);
        RuleFor(x => x.RuntimeMinutes).GreaterThan(0);
        RuleFor(x => x.SeedRating).InclusiveBetween(0, 5);
    }
}

public class CreateMovieCommandHandler : IRequestHandler<CreateMovieCommand, Guid>
{
    private readonly IApplicationDbContext _context;
    public CreateMovieCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task<Guid> Handle(CreateMovieCommand request, CancellationToken ct)
    {
        var movie = new Movie
        {
            Title = request.Title,
            OriginalTitle = request.OriginalTitle,
            Overview = request.Overview,
            ReleaseYear = request.ReleaseYear,
            ReleaseDate = request.ReleaseDate,
            RuntimeMinutes = request.RuntimeMinutes,
            PosterUrl = request.PosterUrl,
            BackdropUrl = request.BackdropUrl,
            Country = request.Country,
            SeedRating = request.SeedRating,
            AverageRating = request.SeedRating,
            MovieGenres = request.GenreIds.Select(gId => new MovieGenre { GenreId = gId }).ToList(),
            MovieDirectors = request.DirectorIds.Select((dId, i) => new MovieDirector { DirectorId = dId, Order = i }).ToList(),
            MovieActors = request.Cast.Select(c => new MovieActor
            {
                ActorId = c.ActorId,
                CharacterName = c.CharacterName,
                Order = c.Order
            }).ToList()
        };

        _context.Movies.Add(movie);
        await _context.SaveChangesAsync(ct);
        return movie.Id;
    }
}

// ---------- UPDATE ----------
public record UpdateMovieCommand(
    Guid Id, string Title, string OriginalTitle, string Overview, int ReleaseYear, DateTime ReleaseDate,
    int RuntimeMinutes, string PosterUrl, string BackdropUrl, List<Guid> DirectorIds, string Country,
    List<Guid> GenreIds, List<CastMemberInput> Cast, double SeedRating
) : IRequest;

public record CastMemberInput(Guid ActorId, string CharacterName, int Order);

public class UpdateMovieCommandHandler : IRequestHandler<UpdateMovieCommand>
{
    private const int MinVotesForFullWeight = 50;

    private readonly IApplicationDbContext _context;
    public UpdateMovieCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task Handle(UpdateMovieCommand request, CancellationToken ct)
    {
        var movie = await _context.Movies
            .Include(m => m.MovieGenres)
            .Include(m => m.MovieActors)
            .Include(m => m.MovieDirectors)
            .FirstOrDefaultAsync(m => m.Id == request.Id, ct)
            ?? throw new NotFoundException(nameof(Movie), request.Id);

        movie.Title = request.Title;
        movie.OriginalTitle = request.OriginalTitle;
        movie.Overview = request.Overview;
        movie.ReleaseYear = request.ReleaseYear;
        movie.ReleaseDate = request.ReleaseDate;
        movie.RuntimeMinutes = request.RuntimeMinutes;
        movie.PosterUrl = request.PosterUrl;
        movie.BackdropUrl = request.BackdropUrl;
        movie.Country = request.Country;
        movie.SeedRating = request.SeedRating;
        movie.UpdatedAtUtc = DateTime.UtcNow;

        movie.MovieGenres.Clear();
        foreach (var genreId in request.GenreIds.Distinct())
            movie.MovieGenres.Add(new MovieGenre { MovieId = movie.Id, GenreId = genreId });

        movie.MovieDirectors.Clear();
        foreach (var (directorId, i) in request.DirectorIds.Select((id, i) => (id, i)))
            movie.MovieDirectors.Add(new MovieDirector { MovieId = movie.Id, DirectorId = directorId, Order = i });

        movie.MovieActors.Clear();
        foreach (var cast in request.Cast)
            movie.MovieActors.Add(new MovieActor { MovieId = movie.Id, ActorId = cast.ActorId, CharacterName = cast.CharacterName, Order = cast.Order });

        await _context.SaveChangesAsync(ct);

        // SeedRating değişmiş olabileceği için AverageRating'i MovieRatingRecalculator ile yeniden hesapla —
        // asla doğrudan SeedRating'e eşitleme, yoksa kullanıcı puanları kaybolur. Formülün tek doğru
        // kaynağı MovieRatingRecalculator'dır, burada tekrar yazılmaz.
        await MovieRatingRecalculator.RecalculateAsync(_context, movie, ct);
    }
}

// ---------- DELETE (soft delete) ----------
public record DeleteMovieCommand(Guid Id) : IRequest;

public class DeleteMovieCommandHandler : IRequestHandler<DeleteMovieCommand>
{
    private readonly IApplicationDbContext _context;
    public DeleteMovieCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task Handle(DeleteMovieCommand request, CancellationToken ct)
    {
        var movie = await _context.Movies.FirstOrDefaultAsync(m => m.Id == request.Id, ct)
            ?? throw new NotFoundException(nameof(Movie), request.Id);

        movie.IsDeleted = true;
        movie.UpdatedAtUtc = DateTime.UtcNow;
        await _context.SaveChangesAsync(ct);
    }
}
