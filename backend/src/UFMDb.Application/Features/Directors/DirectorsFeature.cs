using MediatR;
using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common.Exceptions;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Application.DTOs;
using UFMDb.Domain.Entities;

namespace UFMDb.Application.Features.Directors;

public record DirectorDetailDto(Guid Id, string FullName, DateTime? BirthDate, string Biography, string PhotoUrl, string Nationality, int LikeCount, bool IsLikedByCurrentUser, List<MovieListItemDto> Filmography);

public record GetDirectorsQuery(string? Search, int Page = 1, int PageSize = 20) : IRequest<PagedResult<DirectorListItemDto>>;

public class GetDirectorsQueryHandler : IRequestHandler<GetDirectorsQuery, PagedResult<DirectorListItemDto>>
{
    private readonly IApplicationDbContext _context;
    public GetDirectorsQueryHandler(IApplicationDbContext context) => _context = context;

    public async Task<PagedResult<DirectorListItemDto>> Handle(GetDirectorsQuery request, CancellationToken ct)
    {
        var query = _context.Directors.AsNoTracking().Where(d => !d.IsDeleted);
        if (!string.IsNullOrWhiteSpace(request.Search))
            query = query.Where(d => d.FullName.Contains(request.Search));

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(d => d.MovieDirectors.Count)
            .ThenByDescending(d => d.LikeCount)
            .ThenBy(d => d.FullName)
            .Skip((request.Page - 1) * request.PageSize).Take(request.PageSize)
            .Select(d => new DirectorListItemDto(d.Id, d.FullName, d.PhotoUrl, d.Nationality)).ToListAsync(ct);

        return new PagedResult<DirectorListItemDto>(items, total, request.Page, request.PageSize);
    }
}

/// <summary>Yönetmen detay sayfası: filmografisiyle birlikte</summary>
public record GetDirectorDetailQuery(Guid DirectorId, Guid? CurrentUserId) : IRequest<DirectorDetailDto>;

public class GetDirectorDetailQueryHandler : IRequestHandler<GetDirectorDetailQuery, DirectorDetailDto>
{
    private readonly IApplicationDbContext _context;
    public GetDirectorDetailQueryHandler(IApplicationDbContext context) => _context = context;

    public async Task<DirectorDetailDto> Handle(GetDirectorDetailQuery request, CancellationToken ct)
    {
        var director = await _context.Directors.AsNoTracking()
            .Include(d => d.MovieDirectors).ThenInclude(md => md.Movie).ThenInclude(m => m.MovieGenres).ThenInclude(mg => mg.Genre)
            .FirstOrDefaultAsync(d => d.Id == request.DirectorId && !d.IsDeleted, ct)
            ?? throw new NotFoundException(nameof(Director), request.DirectorId);

        var filmography = director.MovieDirectors
            .OrderByDescending(md => md.Movie.ReleaseYear)
            .Select(md => new MovieListItemDto(
                md.Movie.Id, md.Movie.Title, md.Movie.ReleaseYear, md.Movie.PosterUrl,
                md.Movie.AverageRating, md.Movie.RatingCount,
                md.Movie.MovieGenres.Select(mg => mg.Genre.Name).ToList(),
                md.Movie.BackdropUrl, md.Movie.Overview, false))
            .ToList();

        var isLiked = request.CurrentUserId is Guid uid &&
            await _context.DirectorLikes.AsNoTracking().AnyAsync(l => l.DirectorId == director.Id && l.UserId == uid, ct);

        return new DirectorDetailDto(director.Id, director.FullName, director.BirthDate, director.Biography, director.PhotoUrl, director.Nationality, director.LikeCount, isLiked, filmography);
    }
}

// ---------- Yönetmeni beğen / beğenmekten vazgeç (toggle) ----------
public record ToggleDirectorLikeCommand(Guid DirectorId, Guid UserId) : IRequest<bool>;

public class ToggleDirectorLikeCommandHandler : IRequestHandler<ToggleDirectorLikeCommand, bool>
{
    private readonly IApplicationDbContext _context;
    public ToggleDirectorLikeCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task<bool> Handle(ToggleDirectorLikeCommand request, CancellationToken ct)
    {
        var director = await _context.Directors.FirstOrDefaultAsync(d => d.Id == request.DirectorId, ct)
            ?? throw new NotFoundException(nameof(Director), request.DirectorId);

        var existing = await _context.DirectorLikes
            .FirstOrDefaultAsync(l => l.DirectorId == request.DirectorId && l.UserId == request.UserId, ct);

        bool nowLiked;
        if (existing is null)
        {
            _context.DirectorLikes.Add(new DirectorLike { DirectorId = request.DirectorId, UserId = request.UserId });
            director.LikeCount++;
            nowLiked = true;
        }
        else
        {
            _context.DirectorLikes.Remove(existing);
            director.LikeCount = Math.Max(0, director.LikeCount - 1);
            nowLiked = false;
        }

        await _context.SaveChangesAsync(ct);
        return nowLiked;
    }
}

// ---------- Admin: Yönetmen yönetimi ----------
public record CreateDirectorCommand(string FullName, DateTime? BirthDate, string Biography, string PhotoUrl, string Nationality) : IRequest<Guid>;

public class CreateDirectorCommandHandler : IRequestHandler<CreateDirectorCommand, Guid>
{
    private readonly IApplicationDbContext _context;
    public CreateDirectorCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task<Guid> Handle(CreateDirectorCommand request, CancellationToken ct)
    {
        var director = new Director
        {
            FullName = request.FullName,
            BirthDate = request.BirthDate,
            Biography = request.Biography,
            PhotoUrl = request.PhotoUrl,
            Nationality = request.Nationality
        };
        _context.Directors.Add(director);
        await _context.SaveChangesAsync(ct);
        return director.Id;
    }
}

public record UpdateDirectorCommand(Guid Id, string FullName, DateTime? BirthDate, string Biography, string PhotoUrl, string Nationality) : IRequest;

public class UpdateDirectorCommandHandler : IRequestHandler<UpdateDirectorCommand>
{
    private readonly IApplicationDbContext _context;
    public UpdateDirectorCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task Handle(UpdateDirectorCommand request, CancellationToken ct)
    {
        var director = await _context.Directors.FirstOrDefaultAsync(d => d.Id == request.Id, ct)
            ?? throw new NotFoundException(nameof(Director), request.Id);

        director.FullName = request.FullName;
        director.BirthDate = request.BirthDate;
        director.Biography = request.Biography;
        director.PhotoUrl = request.PhotoUrl;
        director.Nationality = request.Nationality;
        director.UpdatedAtUtc = DateTime.UtcNow;

        await _context.SaveChangesAsync(ct);
    }
}

public record DeleteDirectorCommand(Guid Id) : IRequest;

public class DeleteDirectorCommandHandler : IRequestHandler<DeleteDirectorCommand>
{
    private readonly IApplicationDbContext _context;
    public DeleteDirectorCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task Handle(DeleteDirectorCommand request, CancellationToken ct)
    {
        var director = await _context.Directors.FirstOrDefaultAsync(d => d.Id == request.Id, ct)
            ?? throw new NotFoundException(nameof(Director), request.Id);
        director.IsDeleted = true;
        await _context.SaveChangesAsync(ct);
    }
}