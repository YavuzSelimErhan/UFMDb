using MediatR;
using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common.Exceptions;
using UFMDb.Application.Common.Interfaces;

namespace UFMDb.Application.Features.Compatibility;

public record CompatibilityDto(int? Score, int CommonCount, int MinRequired);

public record GetCompatibilityQuery(Guid ViewerId, Guid TargetUserId) : IRequest<CompatibilityDto>;

public class GetCompatibilityQueryHandler : IRequestHandler<GetCompatibilityQuery, CompatibilityDto>
{
    private readonly IApplicationDbContext _context;
    public GetCompatibilityQueryHandler(IApplicationDbContext context) => _context = context;

    public async Task<CompatibilityDto> Handle(GetCompatibilityQuery request, CancellationToken ct)
    {
        var targetExists = await _context.Users.AsNoTracking()
            .AnyAsync(u => u.Id == request.TargetUserId, ct);
        if (!targetExists)
            throw new NotFoundException("Kullanıcı", request.TargetUserId);

        var rows = await (
            from a in _context.MovieRatings
            join b in _context.MovieRatings on a.MovieId equals b.MovieId
            where a.UserId == request.ViewerId && b.UserId == request.TargetUserId
            select new { Mine = a.Value, Theirs = b.Value }
        ).AsNoTracking().ToListAsync(ct);

        var pairs = rows.Select(r => (r.Mine, r.Theirs)).ToList();

        return new CompatibilityDto(
            CompatibilityCalculator.Calculate(pairs),
            pairs.Count,
            CompatibilityCalculator.MinCommonCount);
    }
}