using MediatR;
using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common.Interfaces;

namespace UFMDb.Application.Features.Notifications;

public record NotificationDto(
    Guid Id,
    string Type,
    Guid? ActorUserId,
    string? ActorUserName,
    string? ActorFullName,
    string? ActorAvatarUrl,
    Guid? EntityId,
    bool IsRead,
    DateTime CreatedAtUtc
);

// ---------------- Queries ----------------

public record GetMyNotificationsQuery(Guid UserId, int Page = 1, int PageSize = 20)
    : IRequest<List<NotificationDto>>;

public class GetMyNotificationsQueryHandler
    : IRequestHandler<GetMyNotificationsQuery, List<NotificationDto>>
{
    private readonly IApplicationDbContext _context;
    public GetMyNotificationsQueryHandler(IApplicationDbContext context) => _context = context;

    public async Task<List<NotificationDto>> Handle(GetMyNotificationsQuery request, CancellationToken ct)
    {
        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, 50);

        return await _context.Notifications.AsNoTracking()
            .Where(n => n.RecipientUserId == request.UserId)
            .OrderByDescending(n => n.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(n => new NotificationDto(
                n.Id,
                n.Type.ToString(),
                n.ActorUserId,
                n.ActorUser != null ? n.ActorUser.UserName : null,
                n.ActorUser != null ? n.ActorUser.FullName : null,
                n.ActorUser != null ? n.ActorUser.AvatarUrl : null,
                n.EntityId,
                n.IsRead,
                n.CreatedAtUtc
            ))
            .ToListAsync(ct);
    }
}

public record GetUnreadNotificationCountQuery(Guid UserId) : IRequest<int>;

public class GetUnreadNotificationCountQueryHandler
    : IRequestHandler<GetUnreadNotificationCountQuery, int>
{
    private readonly IApplicationDbContext _context;
    public GetUnreadNotificationCountQueryHandler(IApplicationDbContext context) => _context = context;

    public Task<int> Handle(GetUnreadNotificationCountQuery request, CancellationToken ct) =>
        _context.Notifications.AsNoTracking()
            .CountAsync(n => n.RecipientUserId == request.UserId && !n.IsRead, ct);
}

// ---------------- Commands ----------------

public record MarkNotificationReadCommand(Guid UserId, Guid NotificationId) : IRequest;

public class MarkNotificationReadCommandHandler : IRequestHandler<MarkNotificationReadCommand>
{
    private readonly IApplicationDbContext _context;
    public MarkNotificationReadCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task Handle(MarkNotificationReadCommand request, CancellationToken ct)
    {
        var notification = await _context.Notifications
            .FirstOrDefaultAsync(n =>
                n.Id == request.NotificationId && n.RecipientUserId == request.UserId, ct);

        if (notification is null || notification.IsRead)
            return;

        notification.IsRead = true;
        await _context.SaveChangesAsync(ct);
    }
}

public record MarkAllNotificationsReadCommand(Guid UserId) : IRequest;

public class MarkAllNotificationsReadCommandHandler : IRequestHandler<MarkAllNotificationsReadCommand>
{
    private readonly IApplicationDbContext _context;
    public MarkAllNotificationsReadCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task Handle(MarkAllNotificationsReadCommand request, CancellationToken ct)
    {
        var unread = await _context.Notifications
            .Where(n => n.RecipientUserId == request.UserId && !n.IsRead)
            .ToListAsync(ct);

        if (unread.Count == 0)
            return;

        foreach (var n in unread)
            n.IsRead = true;

        await _context.SaveChangesAsync(ct);
    }
}