using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common.Exceptions;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Application.Common.Services;
using UFMDb.Domain.Entities;
using UFMDb.Domain.Enums;

namespace UFMDb.Application.Features.Reviews;

public record ToggleLikeCommand(Guid MovieId, Guid UserId) : IRequest<bool>;

public class ToggleLikeCommandHandler : IRequestHandler<ToggleLikeCommand, bool>
{
    private readonly IApplicationDbContext _context;
    public ToggleLikeCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task<bool> Handle(ToggleLikeCommand request, CancellationToken ct)
    {
        var movie = await _context.Movies.FirstOrDefaultAsync(m => m.Id == request.MovieId, ct)
            ?? throw new NotFoundException(nameof(Movie), request.MovieId);

        var existing = await _context.Likes
            .FirstOrDefaultAsync(l => l.MovieId == request.MovieId && l.UserId == request.UserId, ct);

        bool nowLiked;
        if (existing is null)
        {
            _context.Likes.Add(new Like { MovieId = request.MovieId, UserId = request.UserId });
            movie.LikeCount++;
            nowLiked = true;
        }
        else
        {
            _context.Likes.Remove(existing);
            movie.LikeCount = Math.Max(0, movie.LikeCount - 1);
            nowLiked = false;
        }

        await _context.SaveChangesAsync(ct);
        return nowLiked;
    }
}

// ---------- Hızlı puan: EN SON seansa yazılır (o an sizin "güncel görüşünüz") ----------
public record UpsertRatingCommand(Guid MovieId, Guid UserId, decimal Value) : IRequest;

public class UpsertRatingCommandValidator : AbstractValidator<UpsertRatingCommand>
{
    public UpsertRatingCommandValidator()
    {
        RuleFor(x => x.Value).InclusiveBetween(0.5m, 5.0m);
    }
}

public class UpsertRatingCommandHandler : IRequestHandler<UpsertRatingCommand>
{
    private readonly IApplicationDbContext _context;
    public UpsertRatingCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task Handle(UpsertRatingCommand request, CancellationToken ct)
    {
        var movie = await _context.Movies.FirstOrDefaultAsync(m => m.Id == request.MovieId, ct)
            ?? throw new NotFoundException(nameof(Movie), request.MovieId);

        if (movie.ReleaseDate > DateTime.UtcNow)
            throw new ConflictException("Henüz vizyona girmemiş bir filme puan verilemez.");

        await MovieRatingRecalculator.UpsertCurrentRatingAsync(_context, movie, request.UserId, request.Value, ct);
    }
}

// ---------- Yorum: puandan tamamen bağımsız, filme özel tek metin ----------
public record UpsertReviewCommand(Guid MovieId, Guid UserId, string Content, bool ContainsSpoiler) : IRequest<Guid>;

public class UpsertReviewCommandValidator : AbstractValidator<UpsertReviewCommand>
{
    public UpsertReviewCommandValidator()
    {
        RuleFor(x => x.Content).NotEmpty().MaximumLength(5000);
    }
}

public class UpsertReviewCommandHandler : IRequestHandler<UpsertReviewCommand, Guid>
{
    private readonly IApplicationDbContext _context;
    public UpsertReviewCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task<Guid> Handle(UpsertReviewCommand request, CancellationToken ct)
    {
        var movie = await _context.Movies.FirstOrDefaultAsync(m => m.Id == request.MovieId, ct)
            ?? throw new NotFoundException(nameof(Movie), request.MovieId);

        if (movie.ReleaseDate > DateTime.UtcNow)
            throw new ConflictException("Henüz vizyona girmemiş bir film için yorum yazılamaz.");

        var review = await _context.Reviews
            .FirstOrDefaultAsync(r => r.MovieId == request.MovieId && r.UserId == request.UserId, ct);
        if (review is null)
        {
            review = new Review { MovieId = request.MovieId, UserId = request.UserId };
            _context.Reviews.Add(review);
        }
        review.Content = request.Content;
        review.ContainsSpoiler = request.ContainsSpoiler;
        review.IsDeleted = false;
        review.UpdatedAtUtc = DateTime.UtcNow;

        var alreadyWatched = await _context.WatchHistory
            .AnyAsync(w => w.MovieId == request.MovieId && w.UserId == request.UserId, ct);
        if (!alreadyWatched)
            _context.WatchHistory.Add(new WatchHistory { MovieId = request.MovieId, UserId = request.UserId, WatchedAtUtc = DateTime.UtcNow });

        var watchlistEntry = await _context.WatchlistItems
            .FirstOrDefaultAsync(w => w.MovieId == request.MovieId && w.UserId == request.UserId, ct);
        if (watchlistEntry is not null) _context.WatchlistItems.Remove(watchlistEntry);

        await _context.SaveChangesAsync(ct);
        return review.Id;
    }
}

// ---------- Review sil (soft delete) ----------
public record DeleteReviewCommand(Guid MovieId, Guid UserId) : IRequest;

public class DeleteReviewCommandHandler : IRequestHandler<DeleteReviewCommand>
{
    private readonly IApplicationDbContext _context;
    public DeleteReviewCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task Handle(DeleteReviewCommand request, CancellationToken ct)
    {
        var review = await _context.Reviews
            .FirstOrDefaultAsync(r => r.MovieId == request.MovieId && r.UserId == request.UserId && !r.IsDeleted, ct)
            ?? throw new NotFoundException(nameof(Review), request.MovieId);

        review.IsDeleted = true;
        review.UpdatedAtUtc = DateTime.UtcNow;
        await _context.SaveChangesAsync(ct);
    }
}

public record ToggleReviewLikeCommand(Guid ReviewId, Guid UserId) : IRequest<ReviewLikeResultDto>;
public record ReviewLikeResultDto(bool IsLiked, int LikeCount);

public class ToggleReviewLikeCommandHandler : IRequestHandler<ToggleReviewLikeCommand, ReviewLikeResultDto>
{
    private readonly IApplicationDbContext _context;
    public ToggleReviewLikeCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task<ReviewLikeResultDto> Handle(ToggleReviewLikeCommand request, CancellationToken ct)
    {
        var review = await _context.Reviews
            .FirstOrDefaultAsync(r => r.Id == request.ReviewId && !r.IsDeleted, ct)
            ?? throw new NotFoundException(nameof(Review), request.ReviewId);

        if (review.UserId == request.UserId)
            throw new ConflictException("Kendi yorumunu beğenemezsin.");

        var existing = await _context.ReviewLikes
            .FirstOrDefaultAsync(l => l.ReviewId == request.ReviewId && l.UserId == request.UserId, ct);

        bool nowLiked;
        if (existing is null)
        {
            _context.ReviewLikes.Add(new ReviewLike { ReviewId = request.ReviewId, UserId = request.UserId });
            review.LikeCount++;
            nowLiked = true;
        }
        else
        {
            _context.ReviewLikes.Remove(existing);
            review.LikeCount = Math.Max(0, review.LikeCount - 1);
            nowLiked = false;
        }

        await _context.SaveChangesAsync(ct);
        return new ReviewLikeResultDto(nowLiked, review.LikeCount);
    }
}

// ---------- İzlendi toggle: kapatınca o filme ait TÜM seansları (ve puanlarını) siler ----------
public record ToggleWatchedCommand(Guid MovieId, Guid UserId) : IRequest<bool>;

public class ToggleWatchedCommandHandler : IRequestHandler<ToggleWatchedCommand, bool>
{
    private readonly IApplicationDbContext _context;
    public ToggleWatchedCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task<bool> Handle(ToggleWatchedCommand request, CancellationToken ct)
    {
        var movie = await _context.Movies.FirstOrDefaultAsync(m => m.Id == request.MovieId, ct)
            ?? throw new NotFoundException(nameof(Movie), request.MovieId);

        var existingEntries = await _context.WatchHistory
            .Where(w => w.MovieId == request.MovieId && w.UserId == request.UserId)
            .ToListAsync(ct);

        bool nowWatched;
        if (existingEntries.Count == 0)
        {
            _context.WatchHistory.Add(new WatchHistory { MovieId = request.MovieId, UserId = request.UserId, WatchedAtUtc = DateTime.UtcNow });
            nowWatched = true;
        }
        else
        {
            _context.WatchHistory.RemoveRange(existingEntries);
            nowWatched = false;
        }

        await _context.SaveChangesAsync(ct);
        await MovieRatingRecalculator.RecalculateAsync(_context, movie, ct);
        return nowWatched;
    }
}

public record ToggleWatchlistCommand(Guid MovieId, Guid UserId) : IRequest<bool>;

public class ToggleWatchlistCommandHandler : IRequestHandler<ToggleWatchlistCommand, bool>
{
    private readonly IApplicationDbContext _context;
    public ToggleWatchlistCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task<bool> Handle(ToggleWatchlistCommand request, CancellationToken ct)
    {
        var existing = await _context.WatchlistItems
            .FirstOrDefaultAsync(w => w.MovieId == request.MovieId && w.UserId == request.UserId, ct);

        bool nowInList;
        if (existing is null)
        {
            _context.WatchlistItems.Add(new WatchlistItem { MovieId = request.MovieId, UserId = request.UserId, Status = WatchStatus.PlanToWatch });
            nowInList = true;
        }
        else
        {
            _context.WatchlistItems.Remove(existing);
            nowInList = false;
        }

        await _context.SaveChangesAsync(ct);
        return nowInList;
    }
}