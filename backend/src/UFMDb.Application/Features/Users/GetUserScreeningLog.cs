using MediatR;
using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common;
using UFMDb.Application.Common.Exceptions;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Domain.Entities;
using UFMDb.Domain.Enums;

namespace UFMDb.Application.Features.Users;

/// <summary>
/// Seans Defteri erişim kuralı tek yerde: hem başkasının defterini listeleyen sorgular
/// hem de herkese açık profil sorgusu bunu kullanır.
/// </summary>
public static class DiaryAccess
{
    public static async Task<bool> CanViewAsync(
        IApplicationDbContext context, Guid ownerId, DiaryVisibility visibility, Guid? viewerId, CancellationToken ct)
    {
        if (viewerId.HasValue && viewerId.Value == ownerId) return true;   // sahibi her zaman görür
        if (visibility == DiaryVisibility.Public) return true;
        if (visibility == DiaryVisibility.Followers && viewerId.HasValue)
            return await context.Follows.AsNoTracking()
                .AnyAsync(f => f.FollowerId == viewerId.Value && f.FollowingId == ownerId, ct);
        return false;                                                       // Private (veya takipçi değil)
    }

    /// <summary>Kullanıcı adından sahibi bulur; yoksa 404, görme yetkisi yoksa 403 fırlatır.</summary>
    public static async Task<Guid> ResolveOwnerAsync(
        IApplicationDbContext context, string userName, Guid? viewerId, CancellationToken ct)
    {
        // '_' ve '%' ILIKE'ta joker sayılır ("RingoKid_39" başka bir kullanıcıyla eşleşebilirdi) → kaçışlıyoruz.
        var name = SqlLike.Escape(userName.Trim());
        var owner = await context.Users.AsNoTracking()
            .Where(u => u.IsActive && EF.Functions.ILike(u.UserName, name))
            .Select(u => new { u.Id, u.DiaryVisibility })
            .FirstOrDefaultAsync(ct)
            ?? throw new NotFoundException(nameof(User), userName);

        if (!await CanViewAsync(context, owner.Id, owner.DiaryVisibility, viewerId, ct))
            throw new ForbiddenException("Bu defter gizli.");

        return owner.Id;
    }
}

// ---------- Başkasının defteri: gün bazlı imleçli liste ----------
public record GetUserScreeningLogQuery(
    string UserName,
    Guid? ViewerId,
    string? Cursor = null,
    int PageSize = 20,
    ReactionType? Reaction = null,
    string? Search = null,
    string Lang = "en") : IRequest<ScreeningLogPageDto>;

public class GetUserScreeningLogQueryHandler : IRequestHandler<GetUserScreeningLogQuery, ScreeningLogPageDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ISender _mediator;

    public GetUserScreeningLogQueryHandler(IApplicationDbContext context, ISender mediator)
    {
        _context = context;
        _mediator = mediator;
    }

    public async Task<ScreeningLogPageDto> Handle(GetUserScreeningLogQuery request, CancellationToken ct)
    {
        var ownerId = await DiaryAccess.ResolveOwnerAsync(_context, request.UserName, request.ViewerId, ct);
        // Listeleme mantığı kendi defterimizle aynı: tek kaynak, kopya kod yok.
        return await _mediator.Send(new GetScreeningLogQuery(
            ownerId, request.Cursor, request.PageSize, request.Reaction, request.Search, request.Lang), ct);
    }
}

// ---------- Başkasının defteri: özet istatistikler ----------
public record GetUserScreeningLogSummaryQuery(string UserName, Guid? ViewerId) : IRequest<ScreeningLogSummaryDto>;

public class GetUserScreeningLogSummaryQueryHandler : IRequestHandler<GetUserScreeningLogSummaryQuery, ScreeningLogSummaryDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ISender _mediator;

    public GetUserScreeningLogSummaryQueryHandler(IApplicationDbContext context, ISender mediator)
    {
        _context = context;
        _mediator = mediator;
    }

    public async Task<ScreeningLogSummaryDto> Handle(GetUserScreeningLogSummaryQuery request, CancellationToken ct)
    {
        var ownerId = await DiaryAccess.ResolveOwnerAsync(_context, request.UserName, request.ViewerId, ct);
        return await _mediator.Send(new GetScreeningLogSummaryQuery(ownerId), ct);
    }
}