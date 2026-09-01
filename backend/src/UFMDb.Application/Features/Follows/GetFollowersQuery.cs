using MediatR;
using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common.Interfaces;
namespace UFMDb.Application.Features.Follows;

public record UserSummaryDto(
    Guid Id, string UserName, string? FullName, string? AvatarUrl, bool IsFollowedByCurrentUser
);

public record GetFollowersQuery(Guid UserId, Guid? CurrentUserId) : IRequest<List<UserSummaryDto>>;
public record GetFollowingQuery(Guid UserId, Guid? CurrentUserId) : IRequest<List<UserSummaryDto>>;

public class GetFollowersQueryHandler : IRequestHandler<GetFollowersQuery, List<UserSummaryDto>>
{
    private readonly IApplicationDbContext _context;
    public GetFollowersQueryHandler(IApplicationDbContext context) => _context = context;

    public async Task<List<UserSummaryDto>> Handle(GetFollowersQuery request, CancellationToken ct)
    {
        var users = await _context.Follows.AsNoTracking()
            .Where(f => f.FollowingId == request.UserId)
            .Select(f => new { f.Follower.Id, f.Follower.UserName, f.Follower.FullName, f.Follower.AvatarUrl })
            .ToListAsync(ct);

        var followedIds = request.CurrentUserId.HasValue
            ? (await _context.Follows.AsNoTracking()
                .Where(f => f.FollowerId == request.CurrentUserId.Value &&
                            users.Select(u => u.Id).Contains(f.FollowingId))
                .Select(f => f.FollowingId)
                .ToListAsync(ct)).ToHashSet()
            : new HashSet<Guid>();

        return users.Select(u => new UserSummaryDto(
            u.Id, u.UserName, u.FullName, u.AvatarUrl, followedIds.Contains(u.Id)
        )).ToList();
    }
}

public class GetFollowingQueryHandler : IRequestHandler<GetFollowingQuery, List<UserSummaryDto>>
{
    private readonly IApplicationDbContext _context;
    public GetFollowingQueryHandler(IApplicationDbContext context) => _context = context;

    public async Task<List<UserSummaryDto>> Handle(GetFollowingQuery request, CancellationToken ct)
    {
        var users = await _context.Follows.AsNoTracking()
            .Where(f => f.FollowerId == request.UserId)
            .Select(f => new { f.Following.Id, f.Following.UserName, f.Following.FullName, f.Following.AvatarUrl })
            .ToListAsync(ct);

        var followedIds = request.CurrentUserId.HasValue
            ? (await _context.Follows.AsNoTracking()
                .Where(f => f.FollowerId == request.CurrentUserId.Value &&
                            users.Select(u => u.Id).Contains(f.FollowingId))
                .Select(f => f.FollowingId)
                .ToListAsync(ct)).ToHashSet()
            : new HashSet<Guid>();

        return users.Select(u => new UserSummaryDto(
            u.Id, u.UserName, u.FullName, u.AvatarUrl, followedIds.Contains(u.Id)
        )).ToList();
    }
}