using MediatR;
using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common.Exceptions;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Application.DTOs;
using UFMDb.Application.Features.Actors;
using UFMDb.Application.Features.Users;
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

public record PublicFullProfileDto(
    Guid Id, string UserName, string? FullName, string? AvatarUrl, string? Biography, string? Country, string Gender, DateTime? birthdate,
    List<FavoriteSlotDto> FavoriteMovies,
    List<RecentlyWatchedItemDto> RecentlyWatched,
    List<MovieListItemDto> LikedMovies,
    List<MovieListItemDto> Watchlist,
    List<ReviewSummaryDto> Reviews,
    List<FavoriteActorSlotDto> FavoriteActors,
    List<ActorListItemDto> LikedActors,
    List<FavoriteDirectorSlotDto> FavoriteDirectors,
    List<DirectorListItemDto> LikedDirectors,
    int TotalWatchedCount, decimal? AverageGivenRating, int RatingsCount, DateTime MemberSinceUtc,
    int FollowerCount, int FollowingCount, int ListsCount,
    bool IsFollowedByCurrentUser, bool IsCurrentUser
);

public record GetPublicFullProfileQuery(string UserName, Guid? CurrentUserId) : IRequest<PublicFullProfileDto>;

public class GetPublicFullProfileQueryHandler : IRequestHandler<GetPublicFullProfileQuery, PublicFullProfileDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ISender _mediator;

    public GetPublicFullProfileQueryHandler(IApplicationDbContext context, ISender mediator)
    {
        _context = context;
        _mediator = mediator;
    }

    public async Task<PublicFullProfileDto> Handle(GetPublicFullProfileQuery request, CancellationToken ct)
    {
        var user = await _context.Users.AsNoTracking()
            .FirstOrDefaultAsync(u =>
                u.IsActive && EF.Functions.ILike(u.UserName, request.UserName), ct)
            ?? throw new NotFoundException(nameof(User), request.UserName);

        // Zengin profil verisini mevcut GetProfileQuery'den alıyoruz — mükerrer sorgu yazmıyoruz.
        var profile = await _mediator.Send(new GetProfileQuery(user.Id), ct);

        var followerCount = await _context.Follows.AsNoTracking()
            .CountAsync(f => f.FollowingId == user.Id, ct);
        var followingCount = await _context.Follows.AsNoTracking()
            .CountAsync(f => f.FollowerId == user.Id, ct);
        var isFollowed = request.CurrentUserId.HasValue &&
            await _context.Follows.AsNoTracking().AnyAsync(f =>
                f.FollowerId == request.CurrentUserId.Value && f.FollowingId == user.Id, ct);
        var listsCount = await _context.CuratedLists.AsNoTracking()
            .CountAsync(cl => !cl.IsDeleted && cl.CreatedByUserId == user.Id, ct);

        return new PublicFullProfileDto(
            profile.UserId, profile.UserName, profile.FullName, profile.AvatarUrl, profile.Biography, profile.Country,
            profile.Gender, profile.BirthDate,
            profile.FavoriteMovies, profile.RecentlyWatched, profile.LikedMovies, profile.Watchlist, profile.Reviews,
            profile.FavoriteActors, profile.LikedActors, profile.FavoriteDirectors, profile.LikedDirectors,
            profile.TotalWatchedCount, profile.AverageGivenRating, profile.RatingsCount, profile.MemberSinceUtc,
            followerCount, followingCount, listsCount, isFollowed, request.CurrentUserId == user.Id
        );
    }
}