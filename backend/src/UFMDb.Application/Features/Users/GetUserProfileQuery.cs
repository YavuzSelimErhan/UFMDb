using MediatR;
using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common.Exceptions;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Domain.Entities;
using UFMDb.Domain.Enums;
namespace UFMDb.Application.Features.Follows;

public record PublicProfileDto(
    Guid Id, string UserName, string? FullName, string? AvatarUrl, string? Biography,
    string? Country, Gender Gender,
    int FollowerCount, int FollowingCount,
    bool IsFollowedByCurrentUser, bool IsCurrentUser
);

public record GetUserProfileQuery(string UserName, Guid? CurrentUserId) : IRequest<PublicProfileDto>;

public class GetUserProfileQueryHandler : IRequestHandler<GetUserProfileQuery, PublicProfileDto>
{
    private readonly IApplicationDbContext _context;
    public GetUserProfileQueryHandler(IApplicationDbContext context) => _context = context;

    public async Task<PublicProfileDto> Handle(GetUserProfileQuery request, CancellationToken ct)
    {
        var user = await _context.Users.AsNoTracking()
            .FirstOrDefaultAsync(u =>
                u.IsActive && EF.Functions.ILike(u.UserName, request.UserName), ct)
            ?? throw new NotFoundException(nameof(User), request.UserName);

        var followerCount = await _context.Follows.AsNoTracking()
            .CountAsync(f => f.FollowingId == user.Id, ct);
        var followingCount = await _context.Follows.AsNoTracking()
            .CountAsync(f => f.FollowerId == user.Id, ct);

        var isFollowed = request.CurrentUserId.HasValue &&
            await _context.Follows.AsNoTracking().AnyAsync(f =>
                f.FollowerId == request.CurrentUserId.Value && f.FollowingId == user.Id, ct);

        return new PublicProfileDto(
            user.Id, user.UserName, user.FullName, user.AvatarUrl, user.Biography,
            user.Country, user.Gender,
            followerCount, followingCount,
            isFollowed, request.CurrentUserId == user.Id
        );
    }
}