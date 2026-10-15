using MediatR;
using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Domain.Enums;

namespace UFMDb.Application.Features.Notifications;

/// <param name="EntityId">Türe göre hedef kaydın id'si (ReviewLike: review id, ListLike/ListCreated: liste id).</param>
/// <param name="MovieId">Yorum beğenisi gibi film bağlamlı bildirimlerde gidilecek film.</param>
/// <param name="EntityTitle">Bildirim metninde gösterilecek başlık (film adı veya liste başlığı).</param>
/// <param name="EntityTitleTr">Liste bildirimlerinde Türkçe başlık (diğerlerinde null).</param>
/// <param name="ActorIsFollowedByCurrentUser">Bildirimi tetikleyen kişiyi ben zaten takip ediyor muyum? (Follow bildiriminde "sen de takip et" butonu için.)</param>
public record NotificationDto(
    Guid Id,
    string Type,
    Guid? ActorUserId,
    string? ActorUserName,
    string? ActorFullName,
    string? ActorAvatarUrl,
    Guid? EntityId,
    Guid? MovieId,
    string? EntityTitle,
    string? EntityTitleTr,
    bool ActorIsFollowedByCurrentUser,
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

        var rows = await _context.Notifications.AsNoTracking()
            .Where(n => n.RecipientUserId == request.UserId)
            .OrderByDescending(n => n.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(n => new
            {
                n.Id,
                n.Type,
                n.ActorUserId,
                ActorUserName = n.ActorUser != null ? n.ActorUser.UserName : null,
                ActorFullName = n.ActorUser != null ? n.ActorUser.FullName : null,
                ActorAvatarUrl = n.ActorUser != null ? n.ActorUser.AvatarUrl : null,
                n.EntityId,
                n.IsRead,
                n.CreatedAtUtc
            })
            .ToListAsync(ct);

        // Yorum beğenisi bildirimleri için film bilgisini tek sorguda çöz.
        var reviewIds = rows
            .Where(r => r.Type == NotificationType.ReviewLike && r.EntityId.HasValue)
            .Select(r => r.EntityId!.Value)
            .Distinct()
            .ToList();

        var reviewInfo = new Dictionary<Guid, (Guid MovieId, string Title)>();
        if (reviewIds.Count > 0)
        {
            var found = await _context.Reviews.AsNoTracking()
                .Where(r => reviewIds.Contains(r.Id))
                .Select(r => new { r.Id, r.MovieId, r.Movie.Title })
                .ToListAsync(ct);
            foreach (var r in found)
                reviewInfo[r.Id] = (r.MovieId, r.Title);
        }

        // Liste bildirimleri için liste başlıklarını tek sorguda çöz (silinmiş listeler dışarıda kalır).
        var listIds = rows
            .Where(r => (r.Type == NotificationType.ListLike || r.Type == NotificationType.ListCreated)
                        && r.EntityId.HasValue)
            .Select(r => r.EntityId!.Value)
            .Distinct()
            .ToList();

        var listInfo = new Dictionary<Guid, (string Title, string TitleTr)>();
        if (listIds.Count > 0)
        {
            var foundLists = await _context.CuratedLists.AsNoTracking()
                .Where(cl => listIds.Contains(cl.Id) && !cl.IsDeleted)
                .Select(cl => new { cl.Id, cl.Title, cl.TitleTr })
                .ToListAsync(ct);
            foreach (var l in foundLists)
                listInfo[l.Id] = (l.Title, l.TitleTr);
        }

        // Takip bildirimlerinde: aktörü ben zaten takip ediyor muyum? Tek sorguda çöz.
        var actorIds = rows
            .Where(r => r.Type == NotificationType.Follow && r.ActorUserId.HasValue)
            .Select(r => r.ActorUserId!.Value)
            .Distinct()
            .ToList();

        var followedActorIds = new HashSet<Guid>();
        if (actorIds.Count > 0)
        {
            var followed = await _context.Follows.AsNoTracking()
                .Where(f => f.FollowerId == request.UserId && actorIds.Contains(f.FollowingId))
                .Select(f => f.FollowingId)
                .ToListAsync(ct);
            followedActorIds.UnionWith(followed);
        }

        var result = new List<NotificationDto>(rows.Count);
        foreach (var r in rows)
        {
            Guid? movieId = null;
            string? title = null;
            string? titleTr = null;

            switch (r.Type)
            {
                case NotificationType.ReviewLike:
                    if (r.EntityId.HasValue && reviewInfo.TryGetValue(r.EntityId.Value, out var review))
                    {
                        movieId = review.MovieId;
                        title = review.Title;
                    }
                    break;

                case NotificationType.ListLike:
                case NotificationType.ListCreated:
                    // Liste silinmişse bildirimi gösterme.
                    if (!r.EntityId.HasValue || !listInfo.TryGetValue(r.EntityId.Value, out var list))
                        continue;
                    title = list.Title;
                    titleTr = list.TitleTr;
                    break;
            }

            result.Add(new NotificationDto(
                r.Id,
                r.Type.ToString(),
                r.ActorUserId,
                r.ActorUserName,
                r.ActorFullName,
                r.ActorAvatarUrl,
                r.EntityId,
                movieId,
                title,
                titleTr,
                r.ActorUserId.HasValue && followedActorIds.Contains(r.ActorUserId.Value),
                r.IsRead,
                r.CreatedAtUtc));
        }

        return result;
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