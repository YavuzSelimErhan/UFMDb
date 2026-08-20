using MediatR;
using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common.Exceptions;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Application.DTOs;
using UFMDb.Domain.Entities;

namespace UFMDb.Application.Features.Actors;

public record ActorListItemDto(Guid Id, string FullName, string PhotoUrl, string Nationality);
public record ActorDetailDto(Guid Id, string FullName, DateTime? BirthDate, string Biography, string PhotoUrl, string Nationality, int LikeCount, bool IsLikedByCurrentUser, List<MovieListItemDto> Filmography);

public record GetActorsQuery(string? Search, int Page = 1, int PageSize = 20) : IRequest<PagedResult<ActorListItemDto>>;

public class GetActorsQueryHandler : IRequestHandler<GetActorsQuery, PagedResult<ActorListItemDto>>
{
    private readonly IApplicationDbContext _context;
    public GetActorsQueryHandler(IApplicationDbContext context) => _context = context;

    public async Task<PagedResult<ActorListItemDto>> Handle(GetActorsQuery request, CancellationToken ct)
    {
        var query = _context.Actors.AsNoTracking().Where(a => !a.IsDeleted);
        if (!string.IsNullOrWhiteSpace(request.Search))
            query = query.Where(a => a.FullName.Contains(request.Search));

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(a => a.MovieActors.Count)
            .ThenByDescending(a => a.LikeCount)
            .ThenBy(a => a.FullName)
            .Skip((request.Page - 1) * request.PageSize).Take(request.PageSize)
            .Select(a => new ActorListItemDto(a.Id, a.FullName, a.PhotoUrl, a.Nationality)).ToListAsync(ct);

        return new PagedResult<ActorListItemDto>(items, total, request.Page, request.PageSize);
    }
}

/// <summary>Aktör detay sayfası: oynadığı filmler listesiyle birlikte</summary>
public record GetActorDetailQuery(Guid ActorId, Guid? CurrentUserId) : IRequest<ActorDetailDto>;

public class GetActorDetailQueryHandler : IRequestHandler<GetActorDetailQuery, ActorDetailDto>
{
    private readonly IApplicationDbContext _context;
    public GetActorDetailQueryHandler(IApplicationDbContext context) => _context = context;

    public async Task<ActorDetailDto> Handle(GetActorDetailQuery request, CancellationToken ct)
    {
        var actor = await _context.Actors.AsNoTracking()
            .Include(a => a.MovieActors).ThenInclude(ma => ma.Movie).ThenInclude(m => m.MovieGenres).ThenInclude(mg => mg.Genre)
            .FirstOrDefaultAsync(a => a.Id == request.ActorId && !a.IsDeleted, ct)
            ?? throw new NotFoundException(nameof(Actor), request.ActorId);

        // Filmografideki her filmin, o an giriş yapmış kullanıcı için like/watchlist durumunu
        // tek seferde (toplu) çekip bellekte eşleştiriyoruz.
        var movieIds = actor.MovieActors.Select(ma => ma.Movie.Id).ToHashSet();

        var likedIds = request.CurrentUserId is Guid likeUid
            ? (await _context.Likes.AsNoTracking()
                .Where(l => l.UserId == likeUid && movieIds.Contains(l.MovieId))
                .Select(l => l.MovieId).ToListAsync(ct)).ToHashSet()
            : new HashSet<Guid>();

        var watchlistIds = request.CurrentUserId is Guid watchUid
            ? (await _context.WatchlistItems.AsNoTracking()
                .Where(w => w.UserId == watchUid && movieIds.Contains(w.MovieId))
                .Select(w => w.MovieId).ToListAsync(ct)).ToHashSet()
            : new HashSet<Guid>();

        var filmography = actor.MovieActors
            .OrderByDescending(ma => ma.Movie.ReleaseYear)
            .Select(ma => new MovieListItemDto(
                ma.Movie.Id, ma.Movie.Title, ma.Movie.ReleaseYear, ma.Movie.PosterUrl,
                ma.Movie.AverageRating, ma.Movie.RatingCount,
                ma.Movie.MovieGenres.Select(mg => mg.Genre.Name).ToList(),
                ma.Movie.BackdropUrl, ma.Movie.Overview,
                watchlistIds.Contains(ma.Movie.Id), likedIds.Contains(ma.Movie.Id)))
            .ToList();

        var isLiked = request.CurrentUserId is Guid uid &&
            await _context.ActorLikes.AsNoTracking().AnyAsync(l => l.ActorId == actor.Id && l.UserId == uid, ct);

        return new ActorDetailDto(actor.Id, actor.FullName, actor.BirthDate, actor.Biography, actor.PhotoUrl, actor.Nationality, actor.LikeCount, isLiked, filmography);
    }
}

// ---------- Aktörü beğen / beğenmekten vazgeç (toggle) ----------
public record ToggleActorLikeCommand(Guid ActorId, Guid UserId) : IRequest<bool>;

public class ToggleActorLikeCommandHandler : IRequestHandler<ToggleActorLikeCommand, bool>
{
    private readonly IApplicationDbContext _context;
    public ToggleActorLikeCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task<bool> Handle(ToggleActorLikeCommand request, CancellationToken ct)
    {
        var actor = await _context.Actors.FirstOrDefaultAsync(a => a.Id == request.ActorId, ct)
            ?? throw new NotFoundException(nameof(Actor), request.ActorId);

        var existing = await _context.ActorLikes
            .FirstOrDefaultAsync(l => l.ActorId == request.ActorId && l.UserId == request.UserId, ct);

        bool nowLiked;
        if (existing is null)
        {
            _context.ActorLikes.Add(new ActorLike { ActorId = request.ActorId, UserId = request.UserId });
            actor.LikeCount++;
            nowLiked = true;
        }
        else
        {
            _context.ActorLikes.Remove(existing);
            actor.LikeCount = Math.Max(0, actor.LikeCount - 1);
            nowLiked = false;
        }

        await _context.SaveChangesAsync(ct);
        return nowLiked;
    }
}

// ---------- Admin: Aktör yönetimi ----------
public record CreateActorCommand(string FullName, DateTime? BirthDate, string Biography, string PhotoUrl, string Nationality) : IRequest<Guid>;

public class CreateActorCommandHandler : IRequestHandler<CreateActorCommand, Guid>
{
    private readonly IApplicationDbContext _context;
    public CreateActorCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task<Guid> Handle(CreateActorCommand request, CancellationToken ct)
    {
        var actor = new Actor
        {
            FullName = request.FullName,
            BirthDate = request.BirthDate,
            Biography = request.Biography,
            PhotoUrl = request.PhotoUrl,
            Nationality = request.Nationality
        };
        _context.Actors.Add(actor);
        await _context.SaveChangesAsync(ct);
        return actor.Id;
    }
}

// ---------- Admin: Aktör güncelle ----------
public record UpdateActorCommand(Guid Id, string FullName, DateTime? BirthDate, string Biography, string PhotoUrl, string Nationality) : IRequest;

public class UpdateActorCommandHandler : IRequestHandler<UpdateActorCommand>
{
    private readonly IApplicationDbContext _context;
    public UpdateActorCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task Handle(UpdateActorCommand request, CancellationToken ct)
    {
        var actor = await _context.Actors.FirstOrDefaultAsync(a => a.Id == request.Id, ct)
            ?? throw new NotFoundException(nameof(Actor), request.Id);

        actor.FullName = request.FullName;
        actor.BirthDate = request.BirthDate;
        actor.Biography = request.Biography;
        actor.PhotoUrl = request.PhotoUrl;
        actor.Nationality = request.Nationality;
        actor.UpdatedAtUtc = DateTime.UtcNow;

        await _context.SaveChangesAsync(ct);
    }
}

public record DeleteActorCommand(Guid Id) : IRequest;

public class DeleteActorCommandHandler : IRequestHandler<DeleteActorCommand>
{
    private readonly IApplicationDbContext _context;
    public DeleteActorCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task Handle(DeleteActorCommand request, CancellationToken ct)
    {
        var actor = await _context.Actors.FirstOrDefaultAsync(a => a.Id == request.Id, ct)
            ?? throw new NotFoundException(nameof(Actor), request.Id);
        actor.IsDeleted = true;
        await _context.SaveChangesAsync(ct);
    }
}