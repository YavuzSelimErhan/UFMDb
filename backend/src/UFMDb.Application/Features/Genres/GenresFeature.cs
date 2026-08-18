using MediatR;
using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common.Interfaces;

namespace UFMDb.Application.Features.Genres;

public record GenreDto(Guid Id, string Name, string NameTr, int MovieCount);

public record GetGenresQuery : IRequest<List<GenreDto>>;

public class GetGenresQueryHandler : IRequestHandler<GetGenresQuery, List<GenreDto>>
{
    private readonly IApplicationDbContext _context;
    public GetGenresQueryHandler(IApplicationDbContext context) => _context = context;

    public async Task<List<GenreDto>> Handle(GetGenresQuery request, CancellationToken ct)
    {
        return await _context.Genres.AsNoTracking()
            .OrderBy(g => g.NameTr)
            .Select(g => new GenreDto(g.Id, g.Name, g.NameTr, g.MovieGenres.Count(mg => !mg.Movie.IsDeleted)))
            .ToListAsync(ct);
    }
}
