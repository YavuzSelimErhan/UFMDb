using MediatR;
using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Domain.Enums;

namespace UFMDb.Application.Features.Feed;

/// <summary>
/// Tüm aktivite sayfasındaki bir satır. Aynı kişinin aynı filmdeki, AYNI GÜN içindeki hareketleri
/// (puan + yorum + beğeni gibi) tek satırda birleşir. ReviewContent tam metin (en fazla 600
/// karakter) gelir; ContainsSpoiler true ise gizlemek arayüzün işidir (yorum sayfalarındaki gibi).
/// Reaction: "Like" | "Dislike" | null.
/// </summary>
public record ActivityFeedItemDto(
    FriendActivityUserDto User,
    FriendActivityMovieDto Movie,
    bool IsCurrentUser,
    decimal? Rating,
    bool Watched,
    string? Reaction,
    bool HasReview,
    string? ReviewContent,
    bool ContainsSpoiler,
    DateTime LastActivityAtUtc
);

/// <summary>
/// NextBefore: bir sonraki sayfa için imleç (bu zamandan ESKİ hareketler istenir). HasMore false ise sonu.
/// FollowingCount == 0 ise sayfa yalnızca kullanıcının kendi hareketlerini içerir, arayüz
/// "Arkadaşlarını bul" davetini gösterebilir.
/// </summary>
public record ActivityFeedPageDto(
    int FollowingCount,
    List<ActivityFeedItemDto> Items,
    DateTime? NextBefore,
    bool HasMore
);

/// <summary>Type: all | reviews | ratings | diary | reactions (bilinmeyen değer "all" sayılır).</summary>
public record GetActivityFeedQuery(Guid UserId, DateTime? Before, string? Type, int PageSize, string Lang = "en", Guid? BeforeUser = null, Guid? BeforeMovie = null, string TimeZone = "UTC")
    : IRequest<ActivityFeedPageDto>;

public class GetActivityFeedQueryHandler : IRequestHandler<GetActivityFeedQuery, ActivityFeedPageDto>
{
    private const int DefaultPageSize = 20;
    private const int MaxPageSize = 50;
    private const int ReviewTextLength = 600;

    private enum Kind { Rating, Watch, Reaction, Review }

    private sealed class Row
    {
        public Guid UserId;
        public Guid MovieId;
        public decimal? Rating;
        public bool Watched;
        public ReactionType? Reaction;
        public string? Content;
        public bool Spoiler;
        public DateTime Last;
    }

    private readonly IApplicationDbContext _context;
    public GetActivityFeedQueryHandler(IApplicationDbContext context) => _context = context;

    public async Task<ActivityFeedPageDto> Handle(GetActivityFeedQuery request, CancellationToken ct)
    {
        var pageSize = request.PageSize <= 0 ? DefaultPageSize : Math.Min(request.PageSize, MaxPageSize);
        var type = (request.Type ?? "all").Trim().ToLowerInvariant();
        if (type is not ("all" or "reviews" or "ratings" or "diary" or "reactions")) type = "all";
        var isTr = Localization.IsTurkish(request.Lang);
        var before = NormalizeUtc(request.Before);

        var friendIds = await _context.Follows.AsNoTracking()
            .Where(f => f.FollowerId == request.UserId
                        && f.FollowingId != request.UserId
                        && f.Following.IsActive)
            .Select(f => f.FollowingId)
            .ToListAsync(ct);

        // Kendi aktivitesi de akışta (arayüz IsCurrentUser ile "Sen" etiketi gösterir).
        var userIds = new List<Guid>(friendIds) { request.UserId };

        var ratingsEvents = _context.MovieRatings.AsNoTracking()
            .Where(x => userIds.Contains(x.UserId) && !x.Movie.IsDeleted)
            .Select(x => new
            {
                x.UserId, x.MovieId, At = x.UpdatedAtUtc ?? x.CreatedAtUtc, Kind = Kind.Rating,
                Rating = (decimal?)x.Value, Reaction = (ReactionType?)null,
                Content = (string?)null, Spoiler = false, x.Id, x.CreatedAtUtc
            });

        var diaryEvents = _context.WatchHistory.AsNoTracking()
            .Where(x => userIds.Contains(x.UserId) && !x.Movie.IsDeleted && (x.UserId == request.UserId || x.User.DiaryVisibility != DiaryVisibility.Private))
            .Select(x => new
            {
                x.UserId, x.MovieId, At = x.WatchedAtUtc, Kind = Kind.Watch,
                Rating = (decimal?)x.Rating, Reaction = (ReactionType?)null,
                Content = (string?)null, Spoiler = false, x.Id, x.CreatedAtUtc
            });

        var reactionsEvents = _context.Likes.AsNoTracking()
            .Where(x => userIds.Contains(x.UserId) && !x.Movie.IsDeleted)
            .Select(x => new
            {
                x.UserId, x.MovieId, At = x.UpdatedAtUtc ?? x.CreatedAtUtc, Kind = Kind.Reaction,
                Rating = (decimal?)null, Reaction = (ReactionType?)x.Reaction,
                Content = (string?)null, Spoiler = false, x.Id, x.CreatedAtUtc
            });

        var reviewsEvents = _context.Reviews.AsNoTracking()
            .Where(x => userIds.Contains(x.UserId) && !x.Movie.IsDeleted && !x.IsDeleted)
            .Select(x => new
            {
                x.UserId, x.MovieId, At = x.UpdatedAtUtc ?? x.CreatedAtUtc, Kind = Kind.Review,
                Rating = (decimal?)null, Reaction = (ReactionType?)null,
                Content = (string?)x.Content, Spoiler = x.ContainsSpoiler, x.Id, x.CreatedAtUtc
            });

        var sources = type switch
        {
            "ratings" => new[] { ratingsEvents },
            "diary" => new[] { diaryEvents },
            "reactions" => new[] { reactionsEvents },
            "reviews" => new[] { reviewsEvents },
            _ => new[] { ratingsEvents, diaryEvents, reactionsEvents, reviewsEvents }
        };

        // Only columns shared by all four tables participate in UNION ALL.
        var timeline = sources.Select(source => source.Select(e => new { e.UserId, e.MovieId, e.At }))
            .Aggregate((left, right) => left.Concat(right));

        var zone = request.TimeZone;
        if (!TimeZoneInfo.TryFindSystemTimeZoneById(zone, out var info) || (zone != "UTC" && !info.HasIanaId))
            throw new UFMDb.Application.Common.Exceptions.ValidationException(new Dictionary<string, string[]>
            {
                ["timeZone"] = new[] { "Geçersiz saat dilimi." }
            });
        var cards = timeline.GroupBy(e => new { e.UserId, e.MovieId, Day = TimeZoneInfo.ConvertTimeBySystemTimeZoneId(e.At, zone).Date })
            .Select(g => new { g.Key.UserId, g.Key.MovieId, g.Key.Day, Last = g.Max(e => e.At) });
        if (before is DateTime boundary)
        {
            if (request.BeforeUser is Guid user && request.BeforeMovie is Guid movie)
                cards = cards.Where(c => c.Last < boundary || (c.Last == boundary &&
                    (c.UserId.CompareTo(user) > 0 || (c.UserId == user && c.MovieId.CompareTo(movie) > 0))));
            else
                cards = cards.Where(c => c.Last < boundary);
        }

        var keys = cards.OrderByDescending(c => c.Last).ThenBy(c => c.UserId).ThenBy(c => c.MovieId)
            .Take(pageSize + 1);
        var queries = sources.Select(source =>
            from e in source
            join k in keys on new { e.UserId, e.MovieId, Day = TimeZoneInfo.ConvertTimeBySystemTimeZoneId(e.At, zone).Date }
                equals new { k.UserId, k.MovieId, k.Day }
            select new { Event = e, k.Day }).ToArray();
        var page = await queries[0].ToListAsync(ct);
        foreach (var query in queries.Skip(1))
            page.AddRange(await query.ToListAsync(ct));

        var merged = new Dictionary<(Guid UserId, Guid MovieId, DateTime Day), Row>();
        foreach (var item in page.OrderByDescending(x => x.Event.At)
                     .ThenByDescending(x => x.Event.CreatedAtUtc).ThenByDescending(x => x.Event.Id))
        {
            var e = item.Event;
            var key = (e.UserId, e.MovieId, item.Day);
            if (!merged.TryGetValue(key, out var row))
            {
                row = new Row { UserId = e.UserId, MovieId = e.MovieId };
                merged[key] = row;
            }

            switch (e.Kind)
            {
                case Kind.Rating:
                    row.Rating = e.Rating;
                    break;
                case Kind.Watch:
                    row.Watched = true;
                    row.Rating ??= e.Rating;
                    break;
                case Kind.Reaction:
                    row.Reaction = e.Reaction;
                    break;
                case Kind.Review:
                    row.Content = e.Content;
                    row.Spoiler = e.Spoiler;
                    break;
            }
            if (e.At > row.Last) row.Last = e.At;
        }

        var sorted = merged.Values.OrderByDescending(r => r.Last).ThenBy(r => r.UserId).ThenBy(r => r.MovieId).ToList();
        var hasMore = sorted.Count > pageSize;
        var selected = sorted.Take(pageSize).ToList();
        DateTime? nextBefore = hasMore ? selected[^1].Last : null;
        var movieIds = selected.Select(r => r.MovieId).Distinct().ToList();
        var rowUserIds = selected.Select(r => r.UserId).Distinct().ToList();

        var movies = await _context.Movies.AsNoTracking()
            .Where(m => !m.IsDeleted && movieIds.Contains(m.Id))
            .Select(m => new
            {
                m.Id,
                Title = isTr && m.TitleTr != "" ? m.TitleTr : m.Title,
                m.PosterUrl,
                m.ReleaseYear,
                Genre = m.MovieGenres
                    .Select(mg => isTr && mg.Genre.NameTr != "" ? mg.Genre.NameTr : mg.Genre.Name)
                    .FirstOrDefault()
            })
            .ToDictionaryAsync(m => m.Id, ct);

        var users = await _context.Users.AsNoTracking()
            .Where(u => rowUserIds.Contains(u.Id))
            .Select(u => new { u.Id, u.UserName, u.FullName, u.AvatarUrl })
            .ToDictionaryAsync(u => u.Id, ct);

        var items = selected
            .Where(r => movies.ContainsKey(r.MovieId) && users.ContainsKey(r.UserId))
            .OrderByDescending(r => r.Last)
            .Select(r =>
            {
                var m = movies[r.MovieId];
                var u = users[r.UserId];
                var hasReview = !string.IsNullOrWhiteSpace(r.Content);
                string? content = null;
                if (hasReview)
                {
                    var text = r.Content!.Trim();
                    content = text.Length > ReviewTextLength ? text[..ReviewTextLength].TrimEnd() + "…" : text;
                }

                return new ActivityFeedItemDto(
                    new FriendActivityUserDto(u.Id, u.UserName, u.FullName, u.AvatarUrl),
                    new FriendActivityMovieDto(m.Id, m.Title, m.PosterUrl, m.ReleaseYear, m.Genre),
                    r.UserId == request.UserId,
                    r.Rating,
                    r.Watched,
                    r.Reaction?.ToString(),
                    hasReview,
                    content,
                    hasReview && r.Spoiler,
                    r.Last);
            })
            .ToList();

        return new ActivityFeedPageDto(friendIds.Count, items, nextBefore, hasMore);
    }

    /// <summary>
    /// Sorgu string'inden gelen DateTime ("...Z") MVC'de Local olarak bağlanabilir; Npgsql
    /// timestamptz'ye Local/Unspecified yazmayı reddeder, bu yüzden her zaman UTC'ye çeviriyoruz.
    /// </summary>
    private static DateTime? NormalizeUtc(DateTime? value)
    {
        if (!value.HasValue) return null;
        var v = value.Value;
        return v.Kind switch
        {
            DateTimeKind.Utc => v,
            DateTimeKind.Local => v.ToUniversalTime(),
            _ => DateTime.SpecifyKind(v, DateTimeKind.Utc)
        };
    }
}