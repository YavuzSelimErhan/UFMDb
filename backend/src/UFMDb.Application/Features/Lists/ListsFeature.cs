using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common.Exceptions;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Application.DTOs;
using UFMDb.Domain.Entities;
namespace UFMDb.Application.Features.Lists;

public record ListSummaryDto(
    Guid Id, string Title, string TitleTr, string Description, string CoverImageUrl, int MovieCount, List<string> CoverPosters,
    bool IsOfficial, Guid CreatedByUserId, string CreatedByUserName, int LikeCount, bool IsLikedByCurrentUser
);
public record ListDetailDto(
    Guid Id, string Title, string TitleTr, string Description, string CoverImageUrl, List<MovieListItemDto> Movies,
    bool IsOfficial, Guid CreatedByUserId, string CreatedByUserName, int LikeCount, bool IsLikedByCurrentUser
);

// ---------- Liste listeleme: scope filtresiyle (resmi / topluluk / benim listelerim) ----------
public enum ListScope { All, Official, Community, Mine, Liked }

public record GetListsQuery(ListScope Scope, Guid? UserId) : IRequest<List<ListSummaryDto>>;
public class GetListsQueryHandler : IRequestHandler<GetListsQuery, List<ListSummaryDto>>
{
    private readonly IApplicationDbContext _context;
    public GetListsQueryHandler(IApplicationDbContext context) => _context = context;

    public async Task<List<ListSummaryDto>> Handle(GetListsQuery request, CancellationToken ct)
    {
        var query = _context.CuratedLists.AsNoTracking().Where(cl => !cl.IsDeleted);

        query = request.Scope switch
        {
            ListScope.Official => query.Where(cl => cl.IsOfficial),
            ListScope.Community => query.Where(cl => !cl.IsOfficial),
            ListScope.Mine => request.UserId.HasValue
                ? query.Where(cl => cl.CreatedByUserId == request.UserId.Value)
                : query.Where(cl => false), // giriş yapmamışsa boş dön
            ListScope.Liked => request.UserId.HasValue
                ? query.Where(cl => _context.CuratedListLikes
                    .Any(l => l.CuratedListId == cl.Id && l.UserId == request.UserId.Value))
                : query.Where(cl => false), // giriş yapmamışsa boş dön
            _ => query
        };

        var lists = await query
            .OrderBy(cl => cl.DisplayOrder)
            .Select(cl => new
            {
                cl.Id,
                cl.Title,
                cl.TitleTr,
                cl.Description,
                cl.CoverImageUrl,
                cl.IsOfficial,
                cl.CreatedByUserId,
                CreatedByUserName = cl.CreatedByUser.UserName,
                cl.LikeCount,
                Count = cl.Items.Count,
                Covers = cl.Items.OrderBy(i => i.Order).Take(4).Select(i => i.Movie.PosterUrl).ToList()
            })
            .ToListAsync(ct);

        HashSet<Guid> likedListIds = request.UserId.HasValue
            ? (await _context.CuratedListLikes.AsNoTracking()
                .Where(l => l.UserId == request.UserId.Value)
                .Select(l => l.CuratedListId)
                .ToListAsync(ct)).ToHashSet()
            : new HashSet<Guid>();

        return lists.Select(l => new ListSummaryDto(
            l.Id, l.Title, l.TitleTr, l.Description, l.CoverImageUrl, l.Count, l.Covers,
            l.IsOfficial, l.CreatedByUserId, l.CreatedByUserName, l.LikeCount,
            likedListIds.Contains(l.Id)
        )).ToList();
    }
}

// ---------- Tekil liste detayı ----------
public record GetListDetailQuery(Guid ListId, Guid? UserId) : IRequest<ListDetailDto>;
public class GetListDetailQueryHandler : IRequestHandler<GetListDetailQuery, ListDetailDto>
{
    private readonly IApplicationDbContext _context;
    public GetListDetailQueryHandler(IApplicationDbContext context) => _context = context;
    public async Task<ListDetailDto> Handle(GetListDetailQuery request, CancellationToken ct)
    {
        var list = await _context.CuratedLists.AsNoTracking()
            .Where(cl => !cl.IsDeleted)
            .Include(cl => cl.Items.OrderBy(i => i.Order)).ThenInclude(i => i.Movie).ThenInclude(m => m.MovieGenres).ThenInclude(mg => mg.Genre)
            .Include(cl => cl.CreatedByUser)
            .FirstOrDefaultAsync(cl => cl.Id == request.ListId, ct)
            ?? throw new NotFoundException(nameof(CuratedList), request.ListId);

        var movies = list.Items.OrderBy(i => i.Order).Select(i => new MovieListItemDto(
            i.Movie.Id, i.Movie.Title, i.Movie.ReleaseYear, i.Movie.PosterUrl,
            (decimal)i.Movie.AverageRating, i.Movie.RatingCount,
            i.Movie.MovieGenres.Select(mg => mg.Genre.Name).ToList(),
            i.Movie.BackdropUrl, i.Movie.Overview,
            false, false, i.Movie.ReleaseDate
        )).ToList();

        bool isLikedByCurrentUser = false;

        if (request.UserId.HasValue)
        {
            if (movies.Count > 0)
            {
                var movieIds = movies.Select(m => m.Id).ToHashSet();

                var watchlistIds = (await _context.WatchlistItems.AsNoTracking()
                    .Where(w => w.UserId == request.UserId.Value && movieIds.Contains(w.MovieId))
                    .Select(w => w.MovieId)
                    .ToListAsync(ct)).ToHashSet();

                var likedIds = (await _context.Likes.AsNoTracking()
                    .Where(l => l.UserId == request.UserId.Value && movieIds.Contains(l.MovieId))
                    .Select(l => l.MovieId)
                    .ToListAsync(ct)).ToHashSet();

                for (int i = 0; i < movies.Count; i++)
                {
                    movies[i] = movies[i] with
                    {
                        IsInWatchlistByCurrentUser = watchlistIds.Contains(movies[i].Id),
                        IsLikedByCurrentUser = likedIds.Contains(movies[i].Id)
                    };
                }
            }

            isLikedByCurrentUser = await _context.CuratedListLikes.AsNoTracking()
                .AnyAsync(l => l.CuratedListId == list.Id && l.UserId == request.UserId.Value, ct);
        }

        return new ListDetailDto(
            list.Id, list.Title, list.TitleTr, list.Description, list.CoverImageUrl, movies,
            list.IsOfficial, list.CreatedByUserId, list.CreatedByUser.UserName, list.LikeCount,
            isLikedByCurrentUser
        );
    }
}

// ---------- Liste oluşturma ----------
// IsOfficial artık istemciden gelmiyor: controller, kullanıcının rolüne göre bu değeri set ediyor.
public record CreateListCommand(
    string Title, string TitleTr, string Description, string CoverImageUrl, int DisplayOrder, List<Guid> MovieIds,
    Guid CreatedByUserId, bool IsOfficial
) : IRequest<Guid>;

public class CreateListCommandValidator : AbstractValidator<CreateListCommand>
{
    public CreateListCommandValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
        RuleFor(x => x.TitleTr).NotEmpty().MaximumLength(200);
    }
}

public class CreateListCommandHandler : IRequestHandler<CreateListCommand, Guid>
{
    private readonly IApplicationDbContext _context;
    public CreateListCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task<Guid> Handle(CreateListCommand request, CancellationToken ct)
    {
        var list = new CuratedList
        {
            Title = request.Title,
            TitleTr = request.TitleTr,
            Description = request.Description,
            CoverImageUrl = request.CoverImageUrl,
            DisplayOrder = request.DisplayOrder,
            CreatedByUserId = request.CreatedByUserId,
            IsOfficial = request.IsOfficial,
            Items = request.MovieIds.Select((id, i) => new CuratedListItem { MovieId = id, Order = i }).ToList()
        };
        _context.CuratedLists.Add(list);
        await _context.SaveChangesAsync(ct);
        return list.Id;
    }
}

// ---------- Liste güncelleme ----------
// Sahiplik kontrolü handler'da: sahibi değilse ve admin de değilse ForbiddenException.
public record UpdateListCommand(
    Guid Id, string Title, string TitleTr, string Description, string CoverImageUrl, int DisplayOrder, List<Guid> MovieIds,
    Guid RequestingUserId, bool IsRequestingUserAdmin
) : IRequest;

public class UpdateListCommandValidator : AbstractValidator<UpdateListCommand>
{
    public UpdateListCommandValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
        RuleFor(x => x.TitleTr).NotEmpty().MaximumLength(200);
    }
}

public class UpdateListCommandHandler : IRequestHandler<UpdateListCommand>
{
    private readonly IApplicationDbContext _context;
    public UpdateListCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task Handle(UpdateListCommand request, CancellationToken ct)
    {
        var list = await _context.CuratedLists
            .Include(cl => cl.Items)
            .FirstOrDefaultAsync(cl => cl.Id == request.Id, ct)
            ?? throw new NotFoundException(nameof(CuratedList), request.Id);

        if (list.CreatedByUserId != request.RequestingUserId && !request.IsRequestingUserAdmin)
            throw new ForbiddenException("Bu listeyi düzenleme yetkin yok.");

        list.Title = request.Title;
        list.TitleTr = request.TitleTr;
        list.Description = request.Description;
        list.CoverImageUrl = request.CoverImageUrl;
        list.DisplayOrder = request.DisplayOrder;
        list.UpdatedAtUtc = DateTime.UtcNow;

        list.Items.Clear();
        foreach (var (movieId, i) in request.MovieIds.Select((id, i) => (id, i)))
            list.Items.Add(new CuratedListItem { CuratedListId = list.Id, MovieId = movieId, Order = i });

        await _context.SaveChangesAsync(ct);
    }
}

// ---------- Liste silme ----------
public record DeleteListCommand(Guid Id, Guid RequestingUserId, bool IsRequestingUserAdmin) : IRequest;

public class DeleteListCommandHandler : IRequestHandler<DeleteListCommand>
{
    private readonly IApplicationDbContext _context;
    public DeleteListCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task Handle(DeleteListCommand request, CancellationToken ct)
    {
        var list = await _context.CuratedLists.FirstOrDefaultAsync(cl => cl.Id == request.Id, ct)
            ?? throw new NotFoundException(nameof(CuratedList), request.Id);

        if (list.CreatedByUserId != request.RequestingUserId && !request.IsRequestingUserAdmin)
            throw new ForbiddenException("Bu listeyi silme yetkin yok.");

        list.IsDeleted = true;
        list.UpdatedAtUtc = DateTime.UtcNow;
        await _context.SaveChangesAsync(ct);
    }
}

// ---------- Beğenme/beğenmekten vazgeçme ----------
public record ToggleListLikeCommand(Guid ListId, Guid UserId) : IRequest<bool>;

public class ToggleListLikeCommandHandler : IRequestHandler<ToggleListLikeCommand, bool>
{
    private readonly IApplicationDbContext _context;
    public ToggleListLikeCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task<bool> Handle(ToggleListLikeCommand request, CancellationToken ct)
    {
        var list = await _context.CuratedLists.FirstOrDefaultAsync(cl => cl.Id == request.ListId, ct)
            ?? throw new NotFoundException(nameof(CuratedList), request.ListId);

        var existing = await _context.CuratedListLikes
            .FirstOrDefaultAsync(l => l.CuratedListId == request.ListId && l.UserId == request.UserId, ct);

        bool isLikedNow;
        if (existing != null)
        {
            _context.CuratedListLikes.Remove(existing);
            list.LikeCount = Math.Max(0, list.LikeCount - 1);
            isLikedNow = false;
        }
        else
        {
            _context.CuratedListLikes.Add(new CuratedListLike { CuratedListId = request.ListId, UserId = request.UserId });
            list.LikeCount += 1;
            isLikedNow = true;
        }

        await _context.SaveChangesAsync(ct);
        return isLikedNow;
    }
}