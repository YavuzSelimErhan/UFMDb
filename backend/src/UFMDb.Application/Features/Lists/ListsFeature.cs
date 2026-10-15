using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common.Exceptions;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Application.DTOs;
using UFMDb.Domain.Entities;
using UFMDb.Domain.Enums;
using ValidationException = UFMDb.Application.Common.Exceptions.ValidationException;
namespace UFMDb.Application.Features.Lists;

// ======================= DTO'lar =======================
public record ListSummaryDto(
    Guid Id, string Slug, string Title, string TitleTr, string Description, string DescriptionTr,
    string CoverImageUrl, int MovieCount, List<string> CoverPosters,
    bool IsRanked, ListVisibility Visibility, ListStatus Status,
    bool IsOfficial, Guid CreatedByUserId, string CreatedByUserName,
    int LikeCount, int ViewCount, bool IsLikedByCurrentUser, DateTime? PublishedAt
);

public record ListItemDto(int Order, string? Note, string? NoteTr, MovieListItemDto Movie);

public record ListDetailDto(
    Guid Id, string Slug, string Title, string TitleTr, string Description, string DescriptionTr,
    string CoverImageUrl, bool IsRanked, ListVisibility Visibility, ListStatus Status,
    List<ListItemDto> Items,
    bool IsOfficial, Guid CreatedByUserId, string CreatedByUserName,
    int LikeCount, int ViewCount, bool IsLikedByCurrentUser, bool CanEdit, DateTime? PublishedAt,
    int DisplayOrder
);

public record ListItemInput(Guid MovieId, string? Note, string? NoteTr);
public record ListCreatedDto(Guid Id, string Slug);
public record PagedListsDto(List<ListSummaryDto> Items, int Page, int PageSize, int TotalCount);

// ======================= Liste listeleme =======================
// User: başka bir kullanıcının profilindeki listeler. Mine: giriş yapan kullanıcının tüm listeleri.
public enum ListScope { All, Official, Community, Mine, Liked, User }
public enum ListSort { Default, Newest, Popular }

public record GetListsQuery(
    ListScope Scope, Guid? ViewerId, Guid? TargetUserId = null,
    ListSort Sort = ListSort.Default, int Page = 1, int PageSize = 24) : IRequest<PagedListsDto>;

public class GetListsQueryHandler : IRequestHandler<GetListsQuery, PagedListsDto>
{
    private readonly IApplicationDbContext _context;
    public GetListsQueryHandler(IApplicationDbContext context) => _context = context;

    public async Task<PagedListsDto> Handle(GetListsQuery request, CancellationToken ct)
    {
        var viewerId = request.ViewerId ?? Guid.Empty;
        var hasViewer = request.ViewerId.HasValue;

        var all = _context.CuratedLists.AsNoTracking().Where(cl => !cl.IsDeleted);
        // Keşif: sadece herkese açık + yayında + en az bir filmi olan
        var discoverable = all.Where(cl => cl.Visibility == ListVisibility.Public
                                           && cl.Status == ListStatus.Published
                                           && cl.ItemCount > 0);
        var empty = all.Where(cl => false);

        IQueryable<CuratedList> query = request.Scope switch
        {
            ListScope.Official => discoverable.Where(cl => cl.IsOfficial),
            ListScope.Community => discoverable.Where(cl => !cl.IsOfficial),
            ListScope.Mine => hasViewer ? all.Where(cl => cl.CreatedByUserId == viewerId) : empty,
            ListScope.Liked => hasViewer
                ? all.Where(cl =>
                    _context.CuratedListLikes.Any(l => l.CuratedListId == cl.Id && l.UserId == viewerId)
                    && (cl.CreatedByUserId == viewerId
                        || (cl.Status == ListStatus.Published && cl.Visibility != ListVisibility.Private)))
                : empty,
            ListScope.User when request.TargetUserId is { } target =>
                // Kendi profilimde hepsi, başkasınınkinde sadece herkese açık olanlar
                request.ViewerId == target
                    ? all.Where(cl => cl.CreatedByUserId == target)
                    : discoverable.Where(cl => cl.CreatedByUserId == target),
            ListScope.User => empty,
            _ => discoverable
        };

        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, 100);
        var total = await query.CountAsync(ct);

        IOrderedQueryable<CuratedList> ordered = request.Sort switch
        {
            ListSort.Popular => query.OrderByDescending(cl => cl.LikeCount)
                                     .ThenByDescending(cl => cl.PublishedAt ?? cl.CreatedAtUtc),
            ListSort.Newest => query.OrderByDescending(cl => cl.PublishedAt ?? cl.CreatedAtUtc),
            _ when request.Scope == ListScope.Official => query.OrderBy(cl => cl.DisplayOrder).ThenBy(cl => cl.Title),
            _ => query.OrderByDescending(cl => cl.PublishedAt ?? cl.CreatedAtUtc)
        };

        var lists = await ordered
            .ThenBy(cl => cl.Id) // eşit değerlerde sayfalar arası tutarlı sıra
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(cl => new
            {
                cl.Id,
                cl.Slug,
                cl.Title,
                cl.TitleTr,
                cl.Description,
                cl.DescriptionTr,
                cl.CoverImageUrl,
                cl.IsRanked,
                cl.Visibility,
                cl.Status,
                cl.IsOfficial,
                cl.CreatedByUserId,
                CreatedByUserName = cl.CreatedByUser.UserName,
                cl.LikeCount,
                cl.ViewCount,
                cl.ItemCount,
                cl.PublishedAt,
                Covers = cl.Items.OrderBy(i => i.Order).Take(4).Select(i => i.Movie.PosterUrl).ToList()
            })
            .ToListAsync(ct);

        var likedListIds = hasViewer
            ? (await _context.CuratedListLikes.AsNoTracking()
                .Where(l => l.UserId == viewerId)
                .Select(l => l.CuratedListId)
                .ToListAsync(ct)).ToHashSet()
            : new HashSet<Guid>();

        var items = lists.Select(l => new ListSummaryDto(
            l.Id, l.Slug, l.Title, l.TitleTr, l.Description, l.DescriptionTr, l.CoverImageUrl,
            l.ItemCount, l.Covers, l.IsRanked, l.Visibility, l.Status,
            l.IsOfficial, l.CreatedByUserId, l.CreatedByUserName,
            l.LikeCount, l.ViewCount, likedListIds.Contains(l.Id), l.PublishedAt
        )).ToList();

        return new PagedListsDto(items, page, pageSize, total);
    }
}

// ======================= Liste detayı (Id veya slug ile) =======================
public record GetListDetailQuery(Guid ListId, Guid? UserId, bool IsAdmin) : IRequest<ListDetailDto>;
public record GetListDetailBySlugQuery(string Slug, Guid? UserId, bool IsAdmin) : IRequest<ListDetailDto>;

public class GetListDetailQueryHandler : IRequestHandler<GetListDetailQuery, ListDetailDto>
{
    private readonly IApplicationDbContext _context;
    public GetListDetailQueryHandler(IApplicationDbContext context) => _context = context;

    public Task<ListDetailDto> Handle(GetListDetailQuery r, CancellationToken ct) =>
        ListDetailBuilder.BuildAsync(_context, _context.CuratedLists.Where(cl => cl.Id == r.ListId), r.ListId, r.UserId, r.IsAdmin, ct);
}

public class GetListDetailBySlugQueryHandler : IRequestHandler<GetListDetailBySlugQuery, ListDetailDto>
{
    private readonly IApplicationDbContext _context;
    public GetListDetailBySlugQueryHandler(IApplicationDbContext context) => _context = context;

    public Task<ListDetailDto> Handle(GetListDetailBySlugQuery r, CancellationToken ct) =>
        ListDetailBuilder.BuildAsync(_context, _context.CuratedLists.Where(cl => cl.Slug == r.Slug), r.Slug, r.UserId, r.IsAdmin, ct);
}

internal static class ListDetailBuilder
{
    public static async Task<ListDetailDto> BuildAsync(
        IApplicationDbContext context, IQueryable<CuratedList> source, object key,
        Guid? userId, bool isAdmin, CancellationToken ct)
    {
        // Erişim yoksa "bulunamadı" dön: private listenin varlığı sızmasın.
        var list = await source.AsNoTracking()
            .VisibleTo(userId, isAdmin)
            .Include(cl => cl.Items.OrderBy(i => i.Order)).ThenInclude(i => i.Movie).ThenInclude(m => m.MovieGenres).ThenInclude(mg => mg.Genre)
            .Include(cl => cl.CreatedByUser)
            .FirstOrDefaultAsync(ct)
            ?? throw new NotFoundException(nameof(CuratedList), key);

        var orderedItems = list.Items.OrderBy(i => i.Order).ToList();
        var movies = orderedItems.Select(i => new MovieListItemDto(
            i.Movie.Id, i.Movie.Title, i.Movie.ReleaseYear, i.Movie.PosterUrl,
            (decimal)i.Movie.AverageRating, i.Movie.RatingCount,
            i.Movie.MovieGenres.Select(mg => mg.Genre.Name).ToList(),
            i.Movie.BackdropUrl, i.Movie.Overview,
            false, false, false, i.Movie.ReleaseDate, null
        )).ToList();

        var isLikedByCurrentUser = false;

        if (userId.HasValue)
        {
            if (movies.Count > 0)
            {
                var movieIds = movies.Select(m => m.Id).ToHashSet();

                var watchlistIds = (await context.WatchlistItems.AsNoTracking()
                    .Where(w => w.UserId == userId.Value && movieIds.Contains(w.MovieId))
                    .Select(w => w.MovieId).ToListAsync(ct)).ToHashSet();

                var reactions = await context.Likes.AsNoTracking()
                    .Where(l => l.UserId == userId.Value && movieIds.Contains(l.MovieId))
                    .ToDictionaryAsync(l => l.MovieId, l => l.Reaction, ct);

                var watchedIds = (await context.WatchHistory.AsNoTracking()
                    .Where(w => w.UserId == userId.Value && movieIds.Contains(w.MovieId))
                    .Select(w => w.MovieId).ToListAsync(ct)).ToHashSet();

                for (var i = 0; i < movies.Count; i++)
                {
                    movies[i] = (movies[i] with
                    {
                        IsInWatchlistByCurrentUser = watchlistIds.Contains(movies[i].Id),
                        IsWatchedByCurrentUser = watchedIds.Contains(movies[i].Id)
                    }).WithReaction(reactions);
                }
            }

            isLikedByCurrentUser = await context.CuratedListLikes.AsNoTracking()
                .AnyAsync(l => l.CuratedListId == list.Id && l.UserId == userId.Value, ct);
        }

        // Görüntülenme sayacı: sahibin kendi bakışları sayılmaz. Tek SQL UPDATE, entity yüklemez.
        if (userId != list.CreatedByUserId)
        {
            await context.CuratedLists.Where(cl => cl.Id == list.Id)
                .ExecuteUpdateAsync(s => s.SetProperty(cl => cl.ViewCount, cl => cl.ViewCount + 1), ct);
        }

        var items = orderedItems
            .Select((it, idx) => new ListItemDto(it.Order, it.Note, it.NoteTr, movies[idx]))
            .ToList();

        var canEdit = isAdmin || userId == list.CreatedByUserId;

        return new ListDetailDto(
            list.Id, list.Slug, list.Title, list.TitleTr, list.Description, list.DescriptionTr,
            list.CoverImageUrl, list.IsRanked, list.Visibility, list.Status, items,
            list.IsOfficial, list.CreatedByUserId, list.CreatedByUser.UserName,
            list.LikeCount, list.ViewCount, isLikedByCurrentUser, canEdit, list.PublishedAt,
            list.DisplayOrder
        );
    }
}

// ======================= Ortak giriş doğrulaması =======================
public interface IListInput
{
    string Title { get; }
    string TitleTr { get; }
    string Description { get; }
    string DescriptionTr { get; }
    string CoverImageUrl { get; }
    ListVisibility Visibility { get; }
    ListStatus Status { get; }
    List<ListItemInput> Items { get; }
}

public abstract class ListInputValidator<T> : AbstractValidator<T> where T : IListInput
{
    protected ListInputValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
        RuleFor(x => x.TitleTr).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Description).MaximumLength(2000);
        RuleFor(x => x.DescriptionTr).MaximumLength(2000);
        RuleFor(x => x.CoverImageUrl).MaximumLength(500)
            .Must(u => string.IsNullOrEmpty(u) ||
                       (Uri.TryCreate(u, UriKind.Absolute, out var uri) &&
                        (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps)))
            .WithMessage("Kapak görseli geçerli bir http(s) adresi olmalı.");
        RuleFor(x => x.Visibility).IsInEnum();
        RuleFor(x => x.Status).IsInEnum();
        RuleFor(x => x.Items).NotNull()
            .Must(i => i.Count <= ListLimits.MaxItemsPerList)
            .WithMessage($"Bir listede en fazla {ListLimits.MaxItemsPerList} film olabilir.");
        RuleForEach(x => x.Items).ChildRules(item =>
        {
            item.RuleFor(i => i.MovieId).NotEmpty();
            item.RuleFor(i => i.Note).MaximumLength(1000);
            item.RuleFor(i => i.NoteTr).MaximumLength(1000);
        });
    }
}

// ======================= Liste oluşturma =======================
public record CreateListCommand(
    string Title, string TitleTr, string Description, string DescriptionTr, string CoverImageUrl,
    int DisplayOrder, bool IsRanked, ListVisibility Visibility, ListStatus Status,
    List<ListItemInput> Items, Guid CreatedByUserId, bool IsOfficial
) : IRequest<ListCreatedDto>, IListInput;

public class CreateListCommandValidator : ListInputValidator<CreateListCommand> { }

public class CreateListCommandHandler : IRequestHandler<CreateListCommand, ListCreatedDto>
{
    private readonly IApplicationDbContext _context;
    public CreateListCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task<ListCreatedDto> Handle(CreateListCommand request, CancellationToken ct)
    {
        if (!request.IsOfficial)
        {
            var count = await _context.CuratedLists.CountAsync(cl =>
                cl.CreatedByUserId == request.CreatedByUserId && !cl.IsDeleted && !cl.IsOfficial, ct);
            if (count >= ListLimits.MaxListsPerUser)
                throw new ValidationException("Title", $"En fazla {ListLimits.MaxListsPerUser} liste oluşturabilirsin.");
        }

        var items = await ListItemsHelper.NormalizeAsync(_context, request.Items, ct);
        var now = DateTime.UtcNow;

        var list = new CuratedList
        {
            Title = request.Title.Trim(),
            TitleTr = request.TitleTr.Trim(),
            Description = request.Description?.Trim() ?? string.Empty,
            DescriptionTr = request.DescriptionTr?.Trim() ?? string.Empty,
            CoverImageUrl = request.CoverImageUrl ?? string.Empty,
            IsRanked = request.IsRanked,
            IsOfficial = request.IsOfficial,
            // Resmi koleksiyonlar her zaman herkese açık; vitrin sırası sadece onlar için anlamlı.
            Visibility = request.IsOfficial ? ListVisibility.Public : request.Visibility,
            Status = request.Status,
            DisplayOrder = request.IsOfficial ? request.DisplayOrder : 0,
            CreatedByUserId = request.CreatedByUserId,
            ItemCount = items.Count,
            PublishedAt = request.Status == ListStatus.Published ? now : null,
            Items = items.Select((it, i) => new CuratedListItem
            {
                MovieId = it.MovieId,
                Order = i,
                Note = it.Note,
                NoteTr = it.NoteTr,
                AddedAt = now
            }).ToList()
        };

        // Eşzamanlı iki istek aynı slug'ı üretirse unique index çakışır: rastgele sonekle yeniden dene.
        for (var attempt = 0; ; attempt++)
        {
            list.Slug = attempt == 0
                ? await SlugGenerator.GenerateUniqueAsync(_context, request.Title, ct)
                : SlugGenerator.WithRandomSuffix(request.Title);

            _context.CuratedLists.Add(list);
            try
            {
                await _context.SaveChangesAsync(ct);
                break;
            }
            catch (DbUpdateException) when (attempt < 2)
            {
                _context.CuratedLists.Remove(list); // Added durumundaki graph'ı takipten çıkarır
            }
        }

        await ListNotifications.NotifyFollowersAsync(_context, list, ct);
        return new ListCreatedDto(list.Id, list.Slug);
    }
}

// ======================= Liste güncelleme =======================
// Slug güncellemede DEĞİŞMEZ: eski linkler ve SEO bozulmasın.
public record UpdateListCommand(
    Guid Id, string Title, string TitleTr, string Description, string DescriptionTr, string CoverImageUrl,
    int DisplayOrder, bool IsRanked, ListVisibility Visibility, ListStatus Status,
    List<ListItemInput> Items, Guid RequestingUserId, bool IsRequestingUserAdmin
) : IRequest, IListInput;

public class UpdateListCommandValidator : ListInputValidator<UpdateListCommand> { }

public class UpdateListCommandHandler : IRequestHandler<UpdateListCommand>
{
    private readonly IApplicationDbContext _context;
    public UpdateListCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task Handle(UpdateListCommand request, CancellationToken ct)
    {
        var list = await _context.CuratedLists
            .Include(cl => cl.Items)
            .FirstOrDefaultAsync(cl => cl.Id == request.Id && !cl.IsDeleted, ct)
            ?? throw new NotFoundException(nameof(CuratedList), request.Id);

        ListAccess.EnsureCanEdit(list, request.RequestingUserId, request.IsRequestingUserAdmin);

        var items = await ListItemsHelper.NormalizeAsync(_context, request.Items, ct);
        var now = DateTime.UtcNow;
        var wasNotifiable = ListAccess.IsDiscoverable(list) && list.ItemCount > 0;

        list.Title = request.Title.Trim();
        list.TitleTr = request.TitleTr.Trim();
        list.Description = request.Description?.Trim() ?? string.Empty;
        list.DescriptionTr = request.DescriptionTr?.Trim() ?? string.Empty;
        list.CoverImageUrl = request.CoverImageUrl ?? string.Empty;
        list.IsRanked = request.IsRanked;
        list.Visibility = list.IsOfficial ? ListVisibility.Public : request.Visibility;
        list.Status = request.Status;
        if (list.IsOfficial) list.DisplayOrder = request.DisplayOrder;
        if (request.Status == ListStatus.Published && list.PublishedAt is null) list.PublishedAt = now;
        list.ItemCount = items.Count;
        list.UpdatedAtUtc = now;

        // Fark bazlı senkronizasyon: Clear+yeniden ekleme yerine. Mevcut filmlerin AddedAt'i korunur.
        var incomingIds = items.Select(i => i.MovieId).ToHashSet();
        foreach (var removed in list.Items.Where(i => !incomingIds.Contains(i.MovieId)).ToList())
            list.Items.Remove(removed);

        var existing = list.Items.ToDictionary(i => i.MovieId);
        for (var idx = 0; idx < items.Count; idx++)
        {
            var input = items[idx];
            if (existing.TryGetValue(input.MovieId, out var current))
            {
                current.Order = idx;
                current.Note = input.Note;
                current.NoteTr = input.NoteTr;
            }
            else
            {
                list.Items.Add(new CuratedListItem
                {
                    CuratedListId = list.Id,
                    MovieId = input.MovieId,
                    Order = idx,
                    Note = input.Note,
                    NoteTr = input.NoteTr,
                    AddedAt = now
                });
            }
        }

        await _context.SaveChangesAsync(ct);

        // Sadece "bildirilemez → bildirilebilir" geçişinde (taslağı yayınlama, private → public, boş listeye ilk film).
        var isNotifiable = ListAccess.IsDiscoverable(list) && list.ItemCount > 0;
        if (!wasNotifiable && isNotifiable)
            await ListNotifications.NotifyFollowersAsync(_context, list, ct);
    }
}

// ======================= Liste silme =======================
public record DeleteListCommand(Guid Id, Guid RequestingUserId, bool IsRequestingUserAdmin) : IRequest;

public class DeleteListCommandHandler : IRequestHandler<DeleteListCommand>
{
    private readonly IApplicationDbContext _context;
    public DeleteListCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task Handle(DeleteListCommand request, CancellationToken ct)
    {
        var list = await _context.CuratedLists.FirstOrDefaultAsync(cl => cl.Id == request.Id && !cl.IsDeleted, ct)
            ?? throw new NotFoundException(nameof(CuratedList), request.Id);

        if (list.CreatedByUserId != request.RequestingUserId && !request.IsRequestingUserAdmin)
            throw new ForbiddenException("Bu listeyi silme yetkin yok.");
        if (list.IsOfficial && !request.IsRequestingUserAdmin)
            throw new ForbiddenException("Resmi koleksiyonları sadece admin silebilir.");

        list.IsDeleted = true;
        list.UpdatedAtUtc = DateTime.UtcNow;

        var staleNotifications = await _context.Notifications
            .Where(n => n.EntityId == list.Id &&
                (n.Type == NotificationType.ListLike || n.Type == NotificationType.ListCreated))
            .ToListAsync(ct);
        _context.Notifications.RemoveRange(staleNotifications);

        await _context.SaveChangesAsync(ct);
    }
}

// ======================= Beğenme / vazgeçme =======================
public record ToggleListLikeCommand(Guid ListId, Guid UserId) : IRequest<bool>;

public class ToggleListLikeCommandHandler : IRequestHandler<ToggleListLikeCommand, bool>
{
    private readonly IApplicationDbContext _context;
    public ToggleListLikeCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task<bool> Handle(ToggleListLikeCommand request, CancellationToken ct)
    {
        var list = await _context.CuratedLists.AsNoTracking()
            .FirstOrDefaultAsync(cl => cl.Id == request.ListId && !cl.IsDeleted, ct)
            ?? throw new NotFoundException(nameof(CuratedList), request.ListId);

        // Geri alma her zaman mümkün (liste sonradan private olsa bile). Silinen satır sayısı
        // hangi durumda olduğumuzu söyler; iki eşzamanlı istekten sadece biri 1 görür.
        var removed = await _context.CuratedListLikes
            .Where(l => l.CuratedListId == request.ListId && l.UserId == request.UserId)
            .ExecuteDeleteAsync(ct);

        if (removed > 0)
        {
            await _context.CuratedLists.Where(cl => cl.Id == list.Id)
                .ExecuteUpdateAsync(s => s.SetProperty(cl => cl.LikeCount,
                    cl => cl.LikeCount > 0 ? cl.LikeCount - 1 : 0), ct);

            // Beğen/geri al/beğen bildirim spam'i üretmesin.
            await _context.Notifications.Where(n =>
                n.RecipientUserId == list.CreatedByUserId && n.ActorUserId == request.UserId &&
                n.Type == NotificationType.ListLike && n.EntityId == list.Id).ExecuteDeleteAsync(ct);
            return false;
        }

        // Yeni beğeni için listeyi görebiliyor olmak gerekir.
        if (!ListAccess.CanView(list, request.UserId, isAdmin: false))
            throw new NotFoundException(nameof(CuratedList), request.ListId);

        _context.CuratedListLikes.Add(new CuratedListLike { CuratedListId = request.ListId, UserId = request.UserId });

        if (!list.IsOfficial && list.CreatedByUserId != request.UserId)
        {
            var alreadyNotified = await _context.Notifications.AnyAsync(n =>
                n.RecipientUserId == list.CreatedByUserId && n.ActorUserId == request.UserId &&
                n.Type == NotificationType.ListLike && n.EntityId == list.Id, ct);
            if (!alreadyNotified)
            {
                _context.Notifications.Add(new Notification
                {
                    RecipientUserId = list.CreatedByUserId,
                    ActorUserId = request.UserId,
                    Type = NotificationType.ListLike,
                    EntityId = list.Id,
                });
            }
        }

        try
        {
            await _context.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            // Eşzamanlı istek beğeniyi zaten eklemiş olabilir; öyleyse sayaca dokunmadan "beğenilmiş" dön.
            var exists = await _context.CuratedListLikes.AsNoTracking()
                .AnyAsync(l => l.CuratedListId == request.ListId && l.UserId == request.UserId, ct);
            if (!exists) throw;
            return true;
        }

        await _context.CuratedLists.Where(cl => cl.Id == list.Id)
            .ExecuteUpdateAsync(s => s.SetProperty(cl => cl.LikeCount, cl => cl.LikeCount + 1), ct);
        return true;
    }
}

// ======================= Listeye film ekle / çıkar =======================
public record AddMovieToListCommand(
    Guid ListId, Guid MovieId, string? Note, string? NoteTr,
    Guid RequestingUserId, bool IsRequestingUserAdmin) : IRequest;

public class AddMovieToListCommandValidator : AbstractValidator<AddMovieToListCommand>
{
    public AddMovieToListCommandValidator()
    {
        RuleFor(x => x.MovieId).NotEmpty();
        RuleFor(x => x.Note).MaximumLength(1000);
        RuleFor(x => x.NoteTr).MaximumLength(1000);
    }
}

public class AddMovieToListCommandHandler : IRequestHandler<AddMovieToListCommand>
{
    private readonly IApplicationDbContext _context;
    public AddMovieToListCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task Handle(AddMovieToListCommand request, CancellationToken ct)
    {
        var list = await _context.CuratedLists.Include(cl => cl.Items)
            .FirstOrDefaultAsync(cl => cl.Id == request.ListId && !cl.IsDeleted, ct)
            ?? throw new NotFoundException(nameof(CuratedList), request.ListId);

        ListAccess.EnsureCanEdit(list, request.RequestingUserId, request.IsRequestingUserAdmin);

        if (list.Items.Any(i => i.MovieId == request.MovieId)) return; // idempotent

        if (list.Items.Count >= ListLimits.MaxItemsPerList)
            throw new ValidationException("Items", $"Bir listede en fazla {ListLimits.MaxItemsPerList} film olabilir.");

        if (!await _context.Movies.AnyAsync(m => m.Id == request.MovieId, ct))
            throw new NotFoundException(nameof(Movie), request.MovieId);

        var wasEmpty = list.Items.Count == 0;
        var now = DateTime.UtcNow;

        list.Items.Add(new CuratedListItem
        {
            CuratedListId = list.Id,
            MovieId = request.MovieId,
            Order = wasEmpty ? 0 : list.Items.Max(i => i.Order) + 1,
            Note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim(),
            NoteTr = string.IsNullOrWhiteSpace(request.NoteTr) ? null : request.NoteTr.Trim(),
            AddedAt = now
        });
        list.ItemCount = list.Items.Count;
        list.UpdatedAtUtc = now;

        await _context.SaveChangesAsync(ct);

        // Liste ilk filmini aldığında takipçilere haber ver (daha önce bildirilmişse helper atlar).
        if (wasEmpty) await ListNotifications.NotifyFollowersAsync(_context, list, ct);
    }
}

public record RemoveMovieFromListCommand(
    Guid ListId, Guid MovieId, Guid RequestingUserId, bool IsRequestingUserAdmin) : IRequest;

public class RemoveMovieFromListCommandHandler : IRequestHandler<RemoveMovieFromListCommand>
{
    private readonly IApplicationDbContext _context;
    public RemoveMovieFromListCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task Handle(RemoveMovieFromListCommand request, CancellationToken ct)
    {
        var list = await _context.CuratedLists.Include(cl => cl.Items)
            .FirstOrDefaultAsync(cl => cl.Id == request.ListId && !cl.IsDeleted, ct)
            ?? throw new NotFoundException(nameof(CuratedList), request.ListId);

        ListAccess.EnsureCanEdit(list, request.RequestingUserId, request.IsRequestingUserAdmin);

        var item = list.Items.FirstOrDefault(i => i.MovieId == request.MovieId);
        if (item is null) return; // idempotent

        list.Items.Remove(item);

        // Sıralı listelerde boşluk kalmasın: 0..n-1 olarak yeniden numarala.
        var order = 0;
        foreach (var it in list.Items.OrderBy(i => i.Order)) it.Order = order++;

        list.ItemCount = list.Items.Count;
        list.UpdatedAtUtc = DateTime.UtcNow;
        await _context.SaveChangesAsync(ct);
    }
}

// ======================= "Bu film hangi listelerimde?" =======================
public record MyListMembershipDto(
    Guid Id, string Slug, string Title, string TitleTr, int ItemCount,
    ListVisibility Visibility, ListStatus Status, bool ContainsMovie);

public record GetMyListsForMovieQuery(Guid MovieId, Guid UserId) : IRequest<List<MyListMembershipDto>>;

public class GetMyListsForMovieQueryHandler : IRequestHandler<GetMyListsForMovieQuery, List<MyListMembershipDto>>
{
    private readonly IApplicationDbContext _context;
    public GetMyListsForMovieQueryHandler(IApplicationDbContext context) => _context = context;

    public Task<List<MyListMembershipDto>> Handle(GetMyListsForMovieQuery r, CancellationToken ct) =>
        _context.CuratedLists.AsNoTracking()
            .Where(cl => !cl.IsDeleted && cl.CreatedByUserId == r.UserId)
            .OrderByDescending(cl => cl.CreatedAtUtc)
            .Select(cl => new MyListMembershipDto(
                cl.Id, cl.Slug, cl.Title, cl.TitleTr, cl.ItemCount, cl.Visibility, cl.Status,
                cl.Items.Any(i => i.MovieId == r.MovieId)))
            .ToListAsync(ct);
}