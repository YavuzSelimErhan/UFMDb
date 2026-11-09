using MediatR;
using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common;
using UFMDb.Application.Common.Exceptions;
using UFMDb.Application.Common.Interfaces;

namespace UFMDb.Application.Features.Compatibility;

public record CompatibilityFilmDto(
    Guid MovieId, string Title, int ReleaseYear, string PosterUrl,
    decimal MyRating, decimal TheirRating, decimal Difference);

public record CompatibilityFilmsDto(
    List<CompatibilityFilmDto> Agreements,
    List<CompatibilityFilmDto> Disagreements,
    decimal? AverageDifference);

public record GetCompatibilityFilmsQuery(Guid ViewerId, Guid TargetUserId, string Lang = "en")
    : IRequest<CompatibilityFilmsDto>;

public class GetCompatibilityFilmsQueryHandler
    : IRequestHandler<GetCompatibilityFilmsQuery, CompatibilityFilmsDto>
{
    private readonly IApplicationDbContext _context;
    public GetCompatibilityFilmsQueryHandler(IApplicationDbContext context) => _context = context;

    public async Task<CompatibilityFilmsDto> Handle(GetCompatibilityFilmsQuery request, CancellationToken ct)
    {
        if (request.ViewerId == request.TargetUserId)
            throw new ValidationException("targetUserId", "Kendi profilin için uyum hesaplanamaz.");

        var targetExists = await _context.Users.AsNoTracking()
            .AnyAsync(u => u.Id == request.TargetUserId && u.IsActive, ct);
        if (!targetExists)
            throw new NotFoundException("Kullanıcı", request.TargetUserId);

        var isTr = Localization.IsTurkish(request.Lang);
        var pairs = await CompatibilityPairsLoader.LoadAsync(_context, request.ViewerId, request.TargetUserId, ct);

        var agreements = CompatibilityFilmSelector.Agreements(pairs);
        var disagreements = CompatibilityFilmSelector.Disagreements(pairs);

        var ids = agreements.Concat(disagreements).Select(p => p.MovieId).ToList();
        var movies = await _context.Movies.AsNoTracking()
            .Where(m => ids.Contains(m.Id) && !m.IsDeleted)
            .ToDictionaryAsync(m => m.Id, ct);

        CompatibilityFilmDto? ToDto(RatedPair p) =>
            movies.TryGetValue(p.MovieId, out var m)
                ? new CompatibilityFilmDto(
                    m.Id, MovieText.Title(m, isTr), m.ReleaseYear, m.PosterUrl,
                    p.Mine, p.Theirs, p.Difference)
                : null;

        return new CompatibilityFilmsDto(
            agreements.Select(ToDto).OfType<CompatibilityFilmDto>().ToList(),
            disagreements.Select(ToDto).OfType<CompatibilityFilmDto>().ToList(),
            CompatibilityFilmSelector.AverageDifference(pairs));
    }
}