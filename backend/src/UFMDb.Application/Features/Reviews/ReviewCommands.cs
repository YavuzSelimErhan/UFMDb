using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common;
using UFMDb.Application.Common.Exceptions;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Application.Common.Services;
using UFMDb.Domain.Entities;
using UFMDb.Domain.Enums;

namespace UFMDb.Application.Features.Reviews;

public record ReactToMovieCommand(Guid MovieId, Guid UserId, ReactionType Reaction)
    : IRequest<MovieReactionResultDto>;

public record MovieReactionResultDto(ReactionType? CurrentUserReaction, int LikeCount, int DislikeCount);

public class ReactToMovieCommandHandler : IRequestHandler<ReactToMovieCommand, MovieReactionResultDto>
{
    private readonly IApplicationDbContext _context;
    public ReactToMovieCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task<MovieReactionResultDto> Handle(ReactToMovieCommand request, CancellationToken ct)
    {
        var movie = await _context.Movies.FirstOrDefaultAsync(m => m.Id == request.MovieId, ct)
            ?? throw new NotFoundException(nameof(Movie), request.MovieId);

        var existing = await _context.Likes
            .FirstOrDefaultAsync(l => l.MovieId == request.MovieId && l.UserId == request.UserId, ct);

        ReactionType? current;
        if (existing is null)
        {
            // Reaksiyon yok -> ekle
            _context.Likes.Add(new Like { MovieId = request.MovieId, UserId = request.UserId, Reaction = request.Reaction });
            Adjust(movie, request.Reaction, +1);
            current = request.Reaction;
        }
        else if (existing.Reaction == request.Reaction)
        {
            // Aynı reaksiyona tekrar basıldı -> geri al
            _context.Likes.Remove(existing);
            Adjust(movie, existing.Reaction, -1);
            current = null;
        }
        else
        {
            // Like <-> Dislike geçişi
            Adjust(movie, existing.Reaction, -1);
            existing.Reaction = request.Reaction;
            Adjust(movie, request.Reaction, +1);
            current = request.Reaction;
            existing.UpdatedAtUtc = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync(ct);
        return new MovieReactionResultDto(current, movie.LikeCount, movie.DislikeCount);
    }

    private static void Adjust(Movie movie, ReactionType type, int delta)
    {
        if (type == ReactionType.Like)
            movie.LikeCount = Math.Max(0, movie.LikeCount + delta);
        else
            movie.DislikeCount = Math.Max(0, movie.DislikeCount + delta);
    }
}

// ---------- Hızlı puan: EN SON seansa yazılır (o an sizin "güncel görüşünüz") ----------
public record UpsertRatingCommand(Guid MovieId, Guid UserId, decimal Value) : IRequest;

public class UpsertRatingCommandValidator : AbstractValidator<UpsertRatingCommand>
{
    public UpsertRatingCommandValidator()
    {
        // 0 = puanı kaldır (StarRating'te aynı değere tekrar tıklayınca gönderiliyor)
        RuleFor(x => x.Value).InclusiveBetween(0m, 5.0m);
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

        if (request.Value == 0)
        {
            // Puanı kaldır — izlendi durumuna dokunmuyoruz, film puansız izlenmiş kalabilir.
            await MovieRatingRecalculator.RemoveCurrentRatingAsync(_context, movie, request.UserId, ct);
            return;
        }

        var watchlistEntry = await _context.WatchlistItems
            .FirstOrDefaultAsync(w => w.MovieId == request.MovieId && w.UserId == request.UserId, ct);
        if (watchlistEntry is not null) _context.WatchlistItems.Remove(watchlistEntry);

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

        var staleNotifications = await _context.Notifications
            .Where(n => n.EntityId == review.Id && n.Type == NotificationType.ReviewLike)
            .ToListAsync(ct);
        _context.Notifications.RemoveRange(staleNotifications);

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

            // Yorum sahibine bildirim (aynı kişiden aynı yoruma tekrar bildirim üretme).
            var alreadyNotified = await _context.Notifications.AnyAsync(n =>
                n.RecipientUserId == review.UserId && n.ActorUserId == request.UserId &&
                n.Type == NotificationType.ReviewLike && n.EntityId == review.Id, ct);
            if (!alreadyNotified)
            {
                _context.Notifications.Add(new Notification
                {
                    RecipientUserId = review.UserId,
                    ActorUserId = request.UserId,
                    Type = NotificationType.ReviewLike,
                    EntityId = review.Id,
                });
            }
        }
        else
        {
            _context.ReviewLikes.Remove(existing);
            review.LikeCount = Math.Max(0, review.LikeCount - 1);
            nowLiked = false;

            // Beğeni geri alınınca bildirimi de sil: beğen/geri al/beğen spam üretmesin.
            var stale = await _context.Notifications.Where(n =>
                n.RecipientUserId == review.UserId && n.ActorUserId == request.UserId &&
                n.Type == NotificationType.ReviewLike && n.EntityId == review.Id).ToListAsync(ct);
            _context.Notifications.RemoveRange(stale);
        }

        await _context.SaveChangesAsync(ct);
        return new ReviewLikeResultDto(nowLiked, review.LikeCount);
    }
}

public record LikedReviewItemDto(
    Guid Id,
    Guid MovieId,
    string MovieTitle,
    string PosterUrl,
    Guid UserId,
    string UserName,
    string? UserAvatarUrl,
    string Content,
    bool ContainsSpoiler,
    int LikeCount,
    DateTime CreatedAtUtc
);

public record GetLikedReviewsQuery(Guid UserId, string Lang = "en") : IRequest<List<LikedReviewItemDto>>;

public class GetLikedReviewsQueryHandler : IRequestHandler<GetLikedReviewsQuery, List<LikedReviewItemDto>>
{
    private readonly IApplicationDbContext _context;
    public GetLikedReviewsQueryHandler(IApplicationDbContext context) => _context = context;

    public async Task<List<LikedReviewItemDto>> Handle(GetLikedReviewsQuery request, CancellationToken ct)
    {
        var isTr = Localization.IsTurkish(request.Lang);

        return await _context.ReviewLikes.AsNoTracking()
            .Where(rl => rl.UserId == request.UserId
                         && !rl.Review.IsDeleted
                         && !rl.Review.User.IsDeleted
                         && !rl.Review.Movie.IsDeleted)
            .OrderByDescending(rl => rl.CreatedAtUtc)
            .Select(rl => new LikedReviewItemDto(
                rl.Review.Id,
                rl.Review.MovieId,
                isTr && rl.Review.Movie.TitleTr != "" ? rl.Review.Movie.TitleTr : rl.Review.Movie.Title,
                rl.Review.Movie.PosterUrl,
                rl.Review.UserId,
                rl.Review.User.UserName,
                rl.Review.User.AvatarUrl,
                rl.Review.Content,
                rl.Review.ContainsSpoiler,
                rl.Review.LikeCount,
                rl.Review.CreatedAtUtc))
            .ToListAsync(ct);
    }
}

// ---------- İzlendi toggle: puan varken kapatılamaz (önce puan kaldırılmalı) ----------
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

        var hasQuickRating = await _context.MovieRatings
            .AnyAsync(r => r.MovieId == request.MovieId && r.UserId == request.UserId, ct);

        bool nowWatched;
        if (existingEntries.Count == 0)
        {
            // Puanı olan film zaten "izlenmiş" sayılır (logu olmasa bile): sessizce log eklemek
            // yerine aşağıdaki dalla aynı kuralı uygula.
            if (hasQuickRating)
                throw new ConflictException("Bu filme puan verdiğin için izlenmedi olarak işaretleyemezsin. Önce puanını kaldır.");

            _context.WatchHistory.Add(new WatchHistory { MovieId = request.MovieId, UserId = request.UserId, WatchedAtUtc = DateTime.UtcNow });
            nowWatched = true;

            // LogScreeningCommand ve UpsertReviewCommand'daki aynı davranış: izlendi işaretlenince
            // watchlist'te duruyor olması mantıksız, otomatik kaldırıyoruz.
            var watchlistEntry = await _context.WatchlistItems
                .FirstOrDefaultAsync(w => w.MovieId == request.MovieId && w.UserId == request.UserId, ct);
            if (watchlistEntry is not null) _context.WatchlistItems.Remove(watchlistEntry);
        }
        else
        {
            var hasRatedEntry = existingEntries.Any(w => w.Rating.HasValue);

            if (hasRatedEntry || hasQuickRating)
                throw new ConflictException("Bu filme puan verdiğin için izlenmedi olarak işaretleyemezsin. Önce puanını kaldır.");

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