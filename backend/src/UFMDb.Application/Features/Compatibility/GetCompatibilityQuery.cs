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
    .AnyAsync(u => u.Id == request.TargetUserId && u.IsActive, ct);
        if (!targetExists)
            throw new NotFoundException("Kullanıcı", request.TargetUserId);

        var pairs = (await CompatibilityPairsLoader.LoadAsync(
                _context, request.ViewerId, request.TargetUserId, ct))
            .Select(p => (p.Mine, p.Theirs))
            .ToList();

        return new CompatibilityDto(
            CompatibilityCalculator.Calculate(pairs),
            pairs.Count,
            CompatibilityCalculator.MinCommonCount);
    }
}