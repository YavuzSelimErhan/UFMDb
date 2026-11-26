using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common.Exceptions;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Application.Common.Services;
using UFMDb.Domain.Entities;

namespace UFMDb.Application.Features.Movies.ManageMovie;

/// <summary>PersonId: People tablosundaki kişi kimliği.</summary>
public record CastMemberInput(Guid PersonId, string CharacterName, int Order);

// ---------- Ortak doğrulama kuralları ----------
internal static class MovieRules
{
    public static void Apply<T>(AbstractValidator<T> v,
        System.Linq.Expressions.Expression<Func<T, string>> title,
        System.Linq.Expressions.Expression<Func<T, string>> overview,
        System.Linq.Expressions.Expression<Func<T, int>> year,
        System.Linq.Expressions.Expression<Func<T, int>> runtime,
        System.Linq.Expressions.Expression<Func<T, double?>> seed,
        System.Linq.Expressions.Expression<Func<T, string?>> titleTr,
        System.Linq.Expressions.Expression<Func<T, string?>> overviewTr,
        System.Linq.Expressions.Expression<Func<T, string?>> tagline,
        System.Linq.Expressions.Expression<Func<T, string?>> taglineTr,
        System.Linq.Expressions.Expression<Func<T, string?>> trailerKey)
    {
        v.RuleFor(title).NotEmpty().MaximumLength(300);
        v.RuleFor(overview).MaximumLength(4000);
        v.RuleFor(year).InclusiveBetween(1888, DateTime.UtcNow.Year + 5);
        v.RuleFor(runtime).GreaterThan(0);
        v.RuleFor(seed).InclusiveBetween(0, 5);
        v.RuleFor(titleTr).MaximumLength(300);
        v.RuleFor(overviewTr).MaximumLength(4000);
        v.RuleFor(tagline).MaximumLength(500);
        v.RuleFor(taglineTr).MaximumLength(500);
        v.RuleFor(trailerKey).MaximumLength(50);
    }

    /// <summary>Npgsql timestamptz'ye Local/Unspecified DateTime yazmayı reddeder; her zaman UTC'ye çevir.</summary>
    public static DateTime ToUtc(DateTime d) => d.Kind switch
    {
        DateTimeKind.Utc => d,
        DateTimeKind.Local => d.ToUniversalTime(),
        _ => DateTime.SpecifyKind(d, DateTimeKind.Utc)
    };
}

/// <summary>Admin panelinden girilen oyuncu/yönetmenler için kredi satırı üretir (importer ile aynı Department/Job değerleri).</summary>
internal static class CreditFactory
{
    public const string DirectorJob = "Director";

    public static MovieCredit Cast(CastMemberInput c) => new()
    {
        PersonId = c.PersonId,
        Kind = CreditKind.Cast,
        Department = "Acting",
        Job = "Actor",
        CharacterName = c.CharacterName,
        Order = c.Order
    };

    public static MovieCredit Director(Guid personId, int order) => new()
    {
        PersonId = personId,
        Kind = CreditKind.Crew,
        Department = "Directing",
        Job = DirectorJob,
        Order = order
    };
}

// ---------- CREATE ----------
/// <summary>DirectorIds: yönetmen olacak kişilerin PersonId'leri.</summary>
public record CreateMovieCommand(
    string Title, string OriginalTitle, string Overview, int ReleaseYear, DateTime ReleaseDate,
    int RuntimeMinutes, string PosterUrl, string BackdropUrl, List<Guid> DirectorIds, string Country,
    List<Guid> GenreIds, List<CastMemberInput> Cast, double SeedRating,
    string? TitleTr = null, string? OverviewTr = null, string? Tagline = null,
    string? TaglineTr = null, string? TrailerKey = null
) : IRequest<Guid>;

public class CreateMovieCommandValidator : AbstractValidator<CreateMovieCommand>
{
    public CreateMovieCommandValidator() =>
        MovieRules.Apply(this, x => x.Title, x => x.Overview, x => x.ReleaseYear, x => x.RuntimeMinutes,
            x => x.SeedRating, x => x.TitleTr, x => x.OverviewTr, x => x.Tagline, x => x.TaglineTr, x => x.TrailerKey);
}

public class CreateMovieCommandHandler : IRequestHandler<CreateMovieCommand, Guid>
{
    private readonly IApplicationDbContext _context;
    public CreateMovieCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task<Guid> Handle(CreateMovieCommand request, CancellationToken ct)
    {
        var credits = request.DirectorIds.Distinct()
            .Select((personId, i) => CreditFactory.Director(personId, i))
            .Concat(request.Cast.DistinctBy(c => c.PersonId).Select(CreditFactory.Cast))
            .ToList();

        var movie = new Movie
        {
            Title = request.Title,
            TitleTr = request.TitleTr ?? string.Empty,
            OriginalTitle = request.OriginalTitle,
            Overview = request.Overview,
            OverviewTr = request.OverviewTr ?? string.Empty,
            Tagline = request.Tagline ?? string.Empty,
            TaglineTr = request.TaglineTr ?? string.Empty,
            TrailerKey = request.TrailerKey ?? string.Empty,
            ReleaseYear = request.ReleaseYear,
            ReleaseDate = MovieRules.ToUtc(request.ReleaseDate),
            RuntimeMinutes = request.RuntimeMinutes,
            PosterUrl = request.PosterUrl,
            BackdropUrl = request.BackdropUrl,
            Country = request.Country,
            SeedRating = request.SeedRating,
            AverageRating = request.SeedRating,
            MovieGenres = request.GenreIds.Distinct().Select(gId => new MovieGenre { GenreId = gId }).ToList(),
            Credits = credits
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
    List<Guid> GenreIds, List<CastMemberInput> Cast, double? SeedRating,
    // null = dokunma, "" = temizle
    string? TitleTr = null, string? OverviewTr = null, string? Tagline = null,
    string? TaglineTr = null, string? TrailerKey = null
) : IRequest;

public class UpdateMovieCommandValidator : AbstractValidator<UpdateMovieCommand>
{
    public UpdateMovieCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        MovieRules.Apply(this, x => x.Title, x => x.Overview, x => x.ReleaseYear, x => x.RuntimeMinutes,
            x => x.SeedRating, x => x.TitleTr, x => x.OverviewTr, x => x.Tagline, x => x.TaglineTr, x => x.TrailerKey);
    }
}

public class UpdateMovieCommandHandler : IRequestHandler<UpdateMovieCommand>
{
    private readonly IApplicationDbContext _context;
    public UpdateMovieCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task Handle(UpdateMovieCommand request, CancellationToken ct)
    {
        var movie = await _context.Movies
            .Include(m => m.MovieGenres)
            .FirstOrDefaultAsync(m => m.Id == request.Id && !m.IsDeleted, ct)
            ?? throw new NotFoundException(nameof(Movie), request.Id);

        movie.Title = request.Title;
        movie.OriginalTitle = request.OriginalTitle;
        movie.Overview = request.Overview;
        movie.ReleaseYear = request.ReleaseYear;
        movie.ReleaseDate = MovieRules.ToUtc(request.ReleaseDate);
        movie.RuntimeMinutes = request.RuntimeMinutes;
        movie.PosterUrl = request.PosterUrl;
        movie.BackdropUrl = request.BackdropUrl;
        movie.Country = request.Country;
        if (request.SeedRating.HasValue) movie.SeedRating = request.SeedRating.Value;
        movie.UpdatedAtUtc = DateTime.UtcNow;

        if (request.TitleTr is not null) movie.TitleTr = request.TitleTr;
        if (request.OverviewTr is not null) movie.OverviewTr = request.OverviewTr;
        if (request.Tagline is not null) movie.Tagline = request.Tagline;
        if (request.TaglineTr is not null) movie.TaglineTr = request.TaglineTr;
        if (request.TrailerKey is not null) movie.TrailerKey = request.TrailerKey;

        // ---- Türler (diff) ----
        var wantedGenres = request.GenreIds.ToHashSet();
        foreach (var mg in movie.MovieGenres.Where(x => !wantedGenres.Contains(x.GenreId)).ToList())
            movie.MovieGenres.Remove(mg);
        var haveGenres = movie.MovieGenres.Select(x => x.GenreId).ToHashSet();
        foreach (var genreId in wantedGenres.Where(id => !haveGenres.Contains(id)))
            movie.MovieGenres.Add(new MovieGenre { MovieId = movie.Id, GenreId = genreId });

        var credits = await _context.MovieCredits.Where(c => c.MovieId == movie.Id).ToListAsync(ct);

        // ---- Yönetmenler (diff + sıra). Diğer crew kredilerine (writer, producer...) dokunulmaz. ----
        var wantedDirectors = request.DirectorIds.Distinct().Select((id, i) => (id, i)).ToDictionary(x => x.id, x => x.i);
        var haveDirectors = new Dictionary<Guid, MovieCredit>();
        foreach (var row in credits.Where(c => c.Kind == CreditKind.Crew && c.Job == CreditFactory.DirectorJob))
        {
            // İstenmeyen veya aynı kişiye ait ikinci satırlar silinir
            if (wantedDirectors.ContainsKey(row.PersonId) && haveDirectors.TryAdd(row.PersonId, row)) continue;
            _context.MovieCredits.Remove(row);
        }
        foreach (var (personId, order) in wantedDirectors)
        {
            if (haveDirectors.TryGetValue(personId, out var existing)) existing.Order = order;
            else
            {
                var credit = CreditFactory.Director(personId, order);
                credit.MovieId = movie.Id;
                _context.MovieCredits.Add(credit);
            }
        }

        // ---- Oyuncular (diff + karakter/sıra) ----
        var wantedCast = request.Cast.DistinctBy(c => c.PersonId).ToDictionary(c => c.PersonId);
        var haveCast = new Dictionary<Guid, MovieCredit>();
        foreach (var row in credits.Where(c => c.Kind == CreditKind.Cast))
        {
            if (wantedCast.ContainsKey(row.PersonId) && haveCast.TryAdd(row.PersonId, row)) continue;
            _context.MovieCredits.Remove(row);
        }
        foreach (var cast in wantedCast.Values)
        {
            if (haveCast.TryGetValue(cast.PersonId, out var existing))
            {
                existing.CharacterName = cast.CharacterName;
                existing.Order = cast.Order;
            }
            else
            {
                var credit = CreditFactory.Cast(cast);
                credit.MovieId = movie.Id;
                _context.MovieCredits.Add(credit);
            }
        }

        await _context.SaveChangesAsync(ct);

        // SeedRating değişmiş olabileceği için AverageRating'i MovieRatingRecalculator ile yeniden hesapla —
        // asla doğrudan SeedRating'e eşitleme, yoksa kullanıcı puanları kaybolur.
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