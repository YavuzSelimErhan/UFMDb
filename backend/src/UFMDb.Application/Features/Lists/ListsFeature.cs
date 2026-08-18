using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common.Exceptions;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Application.DTOs;
using UFMDb.Domain.Entities;
namespace UFMDb.Application.Features.Lists;

public record ListSummaryDto(
    Guid Id, string Title, string TitleTr, string Description, string CoverImageUrl, int MovieCount, List<string> CoverPosters
);
public record ListDetailDto(
    Guid Id, string Title, string TitleTr, string Description, string CoverImageUrl, List<MovieListItemDto> Movies
);

// ---------- Tüm sistem listelerini getir (kapak posterleriyle özet halinde) ----------
public record GetListsQuery : IRequest<List<ListSummaryDto>>;
public class GetListsQueryHandler : IRequestHandler<GetListsQuery, List<ListSummaryDto>>
{
    private readonly IApplicationDbContext _context;
    public GetListsQueryHandler(IApplicationDbContext context) => _context = context;
    public async Task<List<ListSummaryDto>> Handle(GetListsQuery request, CancellationToken ct)
    {
        var lists = await _context.CuratedLists.AsNoTracking()
            .Where(cl => !cl.IsDeleted)
            .OrderBy(cl => cl.DisplayOrder)
            .Select(cl => new
            {
                cl.Id,
                cl.Title,
                cl.TitleTr,
                cl.Description,
                cl.CoverImageUrl,
                Count = cl.Items.Count,
                Covers = cl.Items.OrderBy(i => i.Order).Take(4).Select(i => i.Movie.PosterUrl).ToList()
            })
            .ToListAsync(ct);
        return lists.Select(l => new ListSummaryDto(l.Id, l.Title, l.TitleTr, l.Description, l.CoverImageUrl, l.Count, l.Covers)).ToList();
    }
}

// ---------- Tekil liste detayı (tüm filmleriyle) ----------
public record GetListDetailQuery(Guid ListId) : IRequest<ListDetailDto>;
public class GetListDetailQueryHandler : IRequestHandler<GetListDetailQuery, ListDetailDto>
{
    private readonly IApplicationDbContext _context;
    public GetListDetailQueryHandler(IApplicationDbContext context) => _context = context;
    public async Task<ListDetailDto> Handle(GetListDetailQuery request, CancellationToken ct)
    {
        var list = await _context.CuratedLists.AsNoTracking()
            .Where(cl => !cl.IsDeleted)
            .Include(cl => cl.Items.OrderBy(i => i.Order)).ThenInclude(i => i.Movie).ThenInclude(m => m.MovieGenres).ThenInclude(mg => mg.Genre)
            .FirstOrDefaultAsync(cl => cl.Id == request.ListId, ct)
            ?? throw new NotFoundException(nameof(CuratedList), request.ListId);
        var movies = list.Items.OrderBy(i => i.Order).Select(i => new MovieListItemDto(
            i.Movie.Id, i.Movie.Title, i.Movie.ReleaseYear, i.Movie.PosterUrl,
            i.Movie.AverageRating, i.Movie.RatingCount,
            i.Movie.MovieGenres.Select(mg => mg.Genre.Name).ToList(),
            i.Movie.BackdropUrl, i.Movie.Overview
        )).ToList();
        return new ListDetailDto(list.Id, list.Title, list.TitleTr, list.Description, list.CoverImageUrl, movies);
    }
}

// ---------- Admin: Liste yönetimi ----------
public record CreateListCommand(
    string Title, string TitleTr, string Description, string CoverImageUrl, int DisplayOrder, List<Guid> MovieIds
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
            Items = request.MovieIds.Select((id, i) => new CuratedListItem { MovieId = id, Order = i }).ToList()
        };
        _context.CuratedLists.Add(list);
        await _context.SaveChangesAsync(ct);
        return list.Id;
    }
}

public record UpdateListCommand(
    Guid Id, string Title, string TitleTr, string Description, string CoverImageUrl, int DisplayOrder, List<Guid> MovieIds
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

public record DeleteListCommand(Guid Id) : IRequest;

public class DeleteListCommandHandler : IRequestHandler<DeleteListCommand>
{
    private readonly IApplicationDbContext _context;
    public DeleteListCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task Handle(DeleteListCommand request, CancellationToken ct)
    {
        var list = await _context.CuratedLists.FirstOrDefaultAsync(cl => cl.Id == request.Id, ct)
            ?? throw new NotFoundException(nameof(CuratedList), request.Id);
        list.IsDeleted = true;
        list.UpdatedAtUtc = DateTime.UtcNow;
        await _context.SaveChangesAsync(ct);
    }
}