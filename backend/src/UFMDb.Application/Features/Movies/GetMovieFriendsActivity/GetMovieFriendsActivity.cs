using MediatR;
using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Domain.Enums;

namespace UFMDb.Application.Features.Movies.GetMovieFriendsActivity;

public record MovieFriendActivityUserDto(Guid Id, string UserName, string? FullName, string? AvatarUrl);

/// <summary>
/// Takip edilen bir kullanıcının BU filmdeki hareketleri tek kartta.
/// Reaction: "Like" | "Dislike" | null. Spoiler işaretli yorumun metni sunucudan çıkmaz
/// (ContainsSpoiler true, ReviewExcerpt null olur).
/// </summary>
public record MovieFriendActivityDto(
    MovieFriendActivityUserDto User,
    decimal? Rating,
    bool Watched,
    string? Reaction,
    bool HasReview,
    string? ReviewExcerpt,
    bool ContainsSpoiler,
    DateTime LastActivityAtUtc
);

/// <summary>
/// FollowingCount == 0 → kimseyi takip etmiyor. TotalCount, gösterilen Items sayısından büyük olabilir
/// (liste en yeni 12 hareketle sınırlıdır).
/// </summary>
public record MovieFriendsActivityDto(int FollowingCount, int TotalCount, List<MovieFriendActivityDto> Items);

public record GetMovieFriendsActivityQuery(Guid MovieId, Guid UserId) : IRequest<MovieFriendsActivityDto>;

public class GetMovieFriendsActivityQueryHandler
    : IRequestHandler<GetMovieFriendsActivityQuery, MovieFriendsActivityDto>
{
    private const int MaxItems = 12;
    private const int ExcerptLength = 220;

    private readonly IApplicationDbContext _context;
    public GetMovieFriendsActivityQueryHandler(IApplicationDbContext context) => _context = context;

    private sealed class Agg
    {
        public Guid UserId;
        public decimal? Rating;
        public bool Watched;
        public ReactionType? Reaction;
        public string? ReviewContent;
        public bool ContainsSpoiler;
        public DateTime Last;

        public void Touch(DateTime at)
        {
            if (at > Last) Last = at;
        }
    }

    public async Task<MovieFriendsActivityDto> Handle(GetMovieFriendsActivityQuery request, CancellationToken ct)
    {
        var friendIds = await _context.Follows.AsNoTracking()
            .Where(f => f.FollowerId == request.UserId
                        && f.FollowingId != request.UserId
                        && f.Following.IsActive)
            .Select(f => f.FollowingId)
            .ToListAsync(ct);

        if (friendIds.Count == 0)
            return new MovieFriendsActivityDto(0, 0, new List<MovieFriendActivityDto>());

        // DbContext paralel çalışmaz: sorgular sırayla. Hepsi tek film ve takip edilenlerle sınırlı olduğundan küçük.
        var ratings = await _context.MovieRatings.AsNoTracking()
            .Where(r => r.MovieId == request.MovieId && friendIds.Contains(r.UserId))
            .Select(r => new { r.UserId, r.Value, At = r.UpdatedAtUtc ?? r.CreatedAtUtc })
            .ToListAsync(ct);

        var watches = await _context.WatchHistory.AsNoTracking()
            .Where(w => w.MovieId == request.MovieId && friendIds.Contains(w.UserId))
            .Select(w => new { w.UserId, w.Rating, At = w.CreatedAtUtc })
            .ToListAsync(ct);

        var reactions = await _context.Likes.AsNoTracking()
            .Where(l => l.MovieId == request.MovieId && friendIds.Contains(l.UserId))
            .Select(l => new { l.UserId, l.Reaction, At = l.UpdatedAtUtc ?? l.CreatedAtUtc })
            .ToListAsync(ct);

        var reviews = await _context.Reviews.AsNoTracking()
            .Where(r => r.MovieId == request.MovieId && !r.IsDeleted && friendIds.Contains(r.UserId))
            .Select(r => new { r.UserId, r.Content, r.ContainsSpoiler, At = r.UpdatedAtUtc ?? r.CreatedAtUtc })
            .ToListAsync(ct);

        var merged = new Dictionary<Guid, Agg>();
        Agg Get(Guid userId)
        {
            if (!merged.TryGetValue(userId, out var a))
            {
                a = new Agg { UserId = userId };
                merged[userId] = a;
            }
            return a;
        }

        foreach (var r in ratings)
        {
            var a = Get(r.UserId);
            a.Rating = r.Value;
            a.Watched = true; // puanı olan film "izlenmiş" sayılır (profil ve film sayfasıyla aynı tanım)
            a.Touch(r.At);
        }
        foreach (var w in watches)
        {
            var a = Get(w.UserId);
            a.Watched = true;
            a.Rating ??= w.Rating;
            a.Touch(w.At);
        }
        foreach (var l in reactions)
        {
            var a = Get(l.UserId);
            a.Reaction = l.Reaction;
            a.Touch(l.At);
        }
        foreach (var r in reviews)
        {
            var a = Get(r.UserId);
            a.ReviewContent = r.Content;
            a.ContainsSpoiler = r.ContainsSpoiler;
            a.Touch(r.At);
        }

        if (merged.Count == 0)
            return new MovieFriendsActivityDto(friendIds.Count, 0, new List<MovieFriendActivityDto>());

        var top = merged.Values.OrderByDescending(a => a.Last).Take(MaxItems).ToList();
        var userIds = top.Select(a => a.UserId).ToList();

        var users = await _context.Users.AsNoTracking()
            .Where(u => userIds.Contains(u.Id))
            .Select(u => new { u.Id, u.UserName, u.FullName, u.AvatarUrl })
            .ToDictionaryAsync(u => u.Id, ct);

        var items = new List<MovieFriendActivityDto>();
        foreach (var a in top)
        {
            if (!users.TryGetValue(a.UserId, out var u)) continue;

            var hasReview = !string.IsNullOrWhiteSpace(a.ReviewContent);
            var spoiler = hasReview && a.ContainsSpoiler;

            string? excerpt = null;
            if (hasReview && !spoiler)
            {
                var text = a.ReviewContent!.Trim();
                excerpt = text.Length > ExcerptLength ? text[..ExcerptLength].TrimEnd() + "…" : text;
            }

            items.Add(new MovieFriendActivityDto(
                new MovieFriendActivityUserDto(u.Id, u.UserName, u.FullName, u.AvatarUrl),
                a.Rating,
                a.Watched,
                a.Reaction?.ToString(),
                hasReview,
                excerpt,
                spoiler,
                a.Last));
        }

        return new MovieFriendsActivityDto(friendIds.Count, merged.Count, items);
    }
}