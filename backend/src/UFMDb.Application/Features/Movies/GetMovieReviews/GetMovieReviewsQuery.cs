using MediatR;
using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Application.DTOs;

namespace UFMDb.Application.Features.Reviews;

public record ReviewListItemDto(
    Guid Id, Guid UserId, string UserName, string? UserAvatarUrl,
    string Content, bool ContainsSpoiler, int LikeCount, bool IsLikedByCurrentUser,
    DateTime CreatedAtUtc, DateTime? UpdatedAtUtc
);

public record GetMovieReviewsQuery(
    Guid MovieId, Guid? CurrentUserId, int Page, int PageSize, string? SortBy
) : IRequest<PagedResult<ReviewListItemDto>>;

public class GetMovieReviewsQueryHandler : IRequestHandler<GetMovieReviewsQuery, PagedResult<ReviewListItemDto>>
{
    private readonly IApplicationDbContext _context;
    public GetMovieReviewsQueryHandler(IApplicationDbContext context) => _context = context;

    public async Task<PagedResult<ReviewListItemDto>> Handle(GetMovieReviewsQuery request, CancellationToken ct)
    {
        var query = _context.Reviews.AsNoTracking()
            .Include(r => r.User)
            .Where(r => r.MovieId == request.MovieId && !r.IsDeleted);

        query = request.SortBy switch
        {
            "newest" => query.OrderByDescending(r => r.CreatedAtUtc),
            "oldest" => query.OrderBy(r => r.CreatedAtUtc),
            _ => query.OrderByDescending(r => r.LikeCount).ThenByDescending(r => r.CreatedAtUtc)
        };

        var totalCount = await query.CountAsync(ct);

        var pageItems = await query
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(r => new
            {
                r.Id,
                r.UserId,
                r.User.UserName,
                r.User.AvatarUrl,
                r.Content,
                r.ContainsSpoiler,
                r.LikeCount,
                r.CreatedAtUtc,
                r.UpdatedAtUtc
            })
            .ToListAsync(ct);

        var likedReviewIds = new HashSet<Guid>();
        if (request.CurrentUserId.HasValue && pageItems.Count > 0)
        {
            var reviewIds = pageItems.Select(r => r.Id).ToHashSet();
            likedReviewIds = (await _context.ReviewLikes.AsNoTracking()
                .Where(l => l.UserId == request.CurrentUserId.Value && reviewIds.Contains(l.ReviewId))
                .Select(l => l.ReviewId)
                .ToListAsync(ct)).ToHashSet();
        }

        var items = pageItems.Select(r => new ReviewListItemDto(
            r.Id, r.UserId, r.UserName, r.AvatarUrl, r.Content, r.ContainsSpoiler,
            r.LikeCount, likedReviewIds.Contains(r.Id), r.CreatedAtUtc, r.UpdatedAtUtc
        )).ToList();

        return new PagedResult<ReviewListItemDto>(items, totalCount, request.Page, request.PageSize);
    }
}