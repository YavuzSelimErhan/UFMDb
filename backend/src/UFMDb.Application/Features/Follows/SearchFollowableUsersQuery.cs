// Application/Features/Follows/SearchFollowableUsersQuery.cs
using MediatR;
using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Application.DTOs;
namespace UFMDb.Application.Features.Follows;

public record SearchFollowableUsersQuery(string? Search, int Page, int PageSize, Guid? CurrentUserId)
    : IRequest<PagedResult<UserSummaryDto>>;

public class SearchFollowableUsersQueryHandler : IRequestHandler<SearchFollowableUsersQuery, PagedResult<UserSummaryDto>>
{
    private readonly IApplicationDbContext _context;
    public SearchFollowableUsersQueryHandler(IApplicationDbContext context) => _context = context;

    public async Task<PagedResult<UserSummaryDto>> Handle(SearchFollowableUsersQuery request, CancellationToken ct)
    {
        var page = request.Page < 1 ? 1 : request.Page;
        var pageSize = request.PageSize is < 1 or > 100 ? 20 : request.PageSize;

        var query = _context.Users.AsNoTracking().Where(u => u.IsActive);

        if (request.CurrentUserId.HasValue)
            query = query.Where(u => u.Id != request.CurrentUserId.Value);

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var search = $"%{request.Search.Trim()}%";
            query = query.Where(u =>
                EF.Functions.ILike(u.UserName, search) ||
                (u.FullName != null && EF.Functions.ILike(u.FullName, search)));
        }

        var totalCount = await query.CountAsync(ct);

        var users = await query
            .OrderBy(u => u.UserName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new { u.Id, u.UserName, u.FullName, u.AvatarUrl })
            .ToListAsync(ct);

        var followedIds = request.CurrentUserId.HasValue
            ? (await _context.Follows.AsNoTracking()
                .Where(f => f.FollowerId == request.CurrentUserId.Value &&
                            users.Select(u => u.Id).Contains(f.FollowingId))
                .Select(f => f.FollowingId)
                .ToListAsync(ct)).ToHashSet()
            : new HashSet<Guid>();

        var items = users.Select(u => new UserSummaryDto(
            u.Id, u.UserName, u.FullName, u.AvatarUrl, followedIds.Contains(u.Id)
        )).ToList();

        return new PagedResult<UserSummaryDto>(items, totalCount, page, pageSize);
    }
}