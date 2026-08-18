using MediatR;
using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common.Exceptions;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Application.DTOs;
using UFMDb.Domain.Entities;
using UFMDb.Domain.Enums;

namespace UFMDb.Application.Features.Users;

public record AdminUserDto(Guid Id, string UserName, string Email, string Role, bool IsActive, DateTime CreatedAtUtc);

// ---------- Kullanıcıları listele (arama + sayfalama) ----------
public record GetUsersQuery(string? Search, int Page = 1, int PageSize = 20) : IRequest<PagedResult<AdminUserDto>>;

public class GetUsersQueryHandler : IRequestHandler<GetUsersQuery, PagedResult<AdminUserDto>>
{
    private readonly IApplicationDbContext _context;
    public GetUsersQueryHandler(IApplicationDbContext context) => _context = context;

    public async Task<PagedResult<AdminUserDto>> Handle(GetUsersQuery request, CancellationToken ct)
    {
        var query = _context.Users.AsNoTracking().Where(u => !u.IsDeleted);

        if (!string.IsNullOrWhiteSpace(request.Search))
            query = query.Where(u => u.UserName.Contains(request.Search) || u.Email.Contains(request.Search));

        var total = await query.CountAsync(ct);
        var items = await query.OrderBy(u => u.UserName)
            .Skip((request.Page - 1) * request.PageSize).Take(request.PageSize)
            .Select(u => new AdminUserDto(u.Id, u.UserName, u.Email, u.Role.ToString(), u.IsActive, u.CreatedAtUtc))
            .ToListAsync(ct);

        return new PagedResult<AdminUserDto>(items, total, request.Page, request.PageSize);
    }
}

// ---------- Rol değiştir ----------
public record UpdateUserRoleCommand(Guid TargetUserId, Guid ActingAdminId, UserRole NewRole) : IRequest;

public class UpdateUserRoleCommandHandler : IRequestHandler<UpdateUserRoleCommand>
{
    private readonly IApplicationDbContext _context;
    public UpdateUserRoleCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task Handle(UpdateUserRoleCommand request, CancellationToken ct)
    {
        if (request.TargetUserId == request.ActingAdminId)
            throw new ConflictException("Kendi rolünüzü değiştiremezsiniz.");

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == request.TargetUserId, ct)
            ?? throw new NotFoundException(nameof(User), request.TargetUserId);

        user.Role = request.NewRole;
        user.UpdatedAtUtc = DateTime.UtcNow;
        await _context.SaveChangesAsync(ct);
    }
}

// ---------- Aktif / pasif yap ----------
public record ToggleUserActiveCommand(Guid TargetUserId, Guid ActingAdminId) : IRequest<bool>;

public class ToggleUserActiveCommandHandler : IRequestHandler<ToggleUserActiveCommand, bool>
{
    private readonly IApplicationDbContext _context;
    public ToggleUserActiveCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task<bool> Handle(ToggleUserActiveCommand request, CancellationToken ct)
    {
        if (request.TargetUserId == request.ActingAdminId)
            throw new ConflictException("Kendi hesabınızı pasifleştiremezsiniz.");

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == request.TargetUserId, ct)
            ?? throw new NotFoundException(nameof(User), request.TargetUserId);

        user.IsActive = !user.IsActive;
        user.UpdatedAtUtc = DateTime.UtcNow;
        await _context.SaveChangesAsync(ct);
        return user.IsActive;
    }
}
