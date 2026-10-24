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
public record GetActivityFeedQuery(Guid UserId, DateTime? Before, string? Type, int PageSize, string Lang = "en")
    : IRequest<ActivityFeedPageDto>;

public class GetActivityFeedQueryHandler : IRequestHandler<GetActivityFeedQuery, ActivityFeedPageDto>
{
    private const int DefaultPageSize = 20;
    private const int MaxPageSize = 50;
    private const int ReviewTextLength = 600;

    private enum Kind { Rating, Watch, Reaction, Review }

    private sealed class Ev
    {
        public Guid UserId;
        public Guid MovieId;
        public Kind Kind;
        public DateTime At;
        public decimal? Rating;
        public ReactionType? Reaction;
        public string? Content;
        public bool Spoiler;
    }

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

        // Her kaynaktan pageSize + 1 satır: birleşik listede pageSize'dan fazla öğe varsa
        // arkada daha eski hareket var demektir (HasMore tam doğru hesaplanır, fazladan sorgu gerekmez).
        var limit = pageSize + 1;
        var events = new List<Ev>();

        // Zaman damgası: puan/tepki/yorum için son değişiklik (UpdatedAtUtc ?? CreatedAtUtc),
        // günlük için kaydın oluşturulma zamanı (kullanıcı izleme tarihini geçmişe alabildiği için).
        // DbContext paralel çalışmaz: sorgular sırayla.
        if (type is "all" or "ratings")
        {
            // Puanın tek kaynağı MovieRatings (Review'da puan alanı yok).
            var q = _context.MovieRatings.AsNoTracking().Where(r => userIds.Contains(r.UserId));
            if (before.HasValue)
            {
                var b = before.Value;
                q = q.Where(r => (r.UpdatedAtUtc ?? r.CreatedAtUtc) < b);
            }
            var rows = await q
                .OrderByDescending(r => r.UpdatedAtUtc ?? r.CreatedAtUtc)
                .Take(limit)
                .Select(r => new { r.UserId, r.MovieId, r.Value, At = r.UpdatedAtUtc ?? r.CreatedAtUtc })
                .ToListAsync(ct);
            events.AddRange(rows.Select(r => new Ev
            {
                UserId = r.UserId,
                MovieId = r.MovieId,
                Kind = Kind.Rating,
                At = r.At,
                Rating = r.Value
            }));
        }

        if (type is "all" or "diary")
        {
            var q = _context.WatchHistory.AsNoTracking().Where(w => userIds.Contains(w.UserId));
            if (before.HasValue)
            {
                var b = before.Value;
                q = q.Where(w => w.CreatedAtUtc < b);
            }
            var rows = await q
                .OrderByDescending(w => w.CreatedAtUtc)
                .Take(limit)
                .Select(w => new { w.UserId, w.MovieId, w.Rating, At = w.CreatedAtUtc })
                .ToListAsync(ct);
            events.AddRange(rows.Select(w => new Ev
            {
                UserId = w.UserId,
                MovieId = w.MovieId,
                Kind = Kind.Watch,
                At = w.At,
                Rating = w.Rating
            }));
        }

        if (type is "all" or "reactions")
        {
            var q = _context.Likes.AsNoTracking().Where(l => userIds.Contains(l.UserId));
            if (before.HasValue)
            {
                var b = before.Value;
                q = q.Where(l => (l.UpdatedAtUtc ?? l.CreatedAtUtc) < b);
            }
            var rows = await q
                .OrderByDescending(l => l.UpdatedAtUtc ?? l.CreatedAtUtc)
                .Take(limit)
                .Select(l => new { l.UserId, l.MovieId, l.Reaction, At = l.UpdatedAtUtc ?? l.CreatedAtUtc })
                .ToListAsync(ct);
            events.AddRange(rows.Select(l => new Ev
            {
                UserId = l.UserId,
                MovieId = l.MovieId,
                Kind = Kind.Reaction,
                At = l.At,
                Reaction = l.Reaction
            }));
        }

        if (type is "all" or "reviews")
        {
            var q = _context.Reviews.AsNoTracking().Where(r => userIds.Contains(r.UserId) && !r.IsDeleted);
            if (before.HasValue)
            {
                var b = before.Value;
                q = q.Where(r => (r.UpdatedAtUtc ?? r.CreatedAtUtc) < b);
            }
            var rows = await q
                .OrderByDescending(r => r.UpdatedAtUtc ?? r.CreatedAtUtc)
                .Take(limit)
                .Select(r => new { r.UserId, r.MovieId, r.Content, r.ContainsSpoiler, At = r.UpdatedAtUtc ?? r.CreatedAtUtc })
                .ToListAsync(ct);
            events.AddRange(rows.Select(r => new Ev
            {
                UserId = r.UserId,
                MovieId = r.MovieId,
                Kind = Kind.Review,
                At = r.At,
                Content = r.Content,
                Spoiler = r.ContainsSpoiler
            }));
        }

        var ordered = events.OrderByDescending(e => e.At).ToList();
        var hasMore = ordered.Count > pageSize;
        var page = ordered.Take(pageSize).ToList();
        DateTime? nextBefore = hasMore ? page[^1].At : null;

        if (page.Count == 0)
            return new ActivityFeedPageDto(friendIds.Count, new List<ActivityFeedItemDto>(), null, false);

        // Sayfa içinde (kullanıcı, film, gün) bazında tek satır. Sayfa sınırı olayların tam
        // ortasından geçerse aynı günün iki parçası iki sayfaya bölünebilir (nadir ve zararsız);
        // buna karşılık hiçbir olay kaybolmaz ya da iki kez gelmez.
        var merged = new Dictionary<(Guid UserId, Guid MovieId, DateTime Day), Row>();
        foreach (var e in page)
        {
            var key = (e.UserId, e.MovieId, e.At.Date);
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

        var movieIds = merged.Values.Select(r => r.MovieId).Distinct().ToList();
        var rowUserIds = merged.Values.Select(r => r.UserId).Distinct().ToList();

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

        var items = merged.Values
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