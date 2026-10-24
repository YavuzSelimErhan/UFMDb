using MediatR;
using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Domain.Enums;

namespace UFMDb.Application.Features.Feed;

public record FriendActivityUserDto(Guid Id, string UserName, string? FullName, string? AvatarUrl);

public record FriendActivityMovieDto(Guid Id, string Title, string PosterUrl, int ReleaseYear, string? Genre);

/// <summary>
/// Bir arkadaşın bir filmdeki son 7 günlük hareketlerinin tek kartta birleşmiş hali.
/// Reaction: "Like" | "Dislike" | null (enum string olarak döner, frontend string-union bekler).
/// ReviewExcerpt sadece spotlight'ta dolu gelir; spoiler işaretliyse hiçbir zaman dolu gelmez
/// (ContainsSpoiler true olur, metin sunucudan çıkmaz).
/// </summary>
public record FriendActivityDto(
    FriendActivityUserDto User,
    FriendActivityMovieDto Movie,
    decimal? Rating,
    bool Watched,
    string? Reaction,
    bool HasReview,
    string? ReviewExcerpt,
    bool ContainsSpoiler,
    DateTime LastActivityAtUtc
);

/// <summary>
/// FollowingCount == 0  → frontend "Arkadaşlarını bul" kartını gösterir.
/// FollowingCount  > 0 ve Spotlight == null ve Items boş → bölüm gizlenir.
/// WeeklyActiveFriendCount / WeeklyActivityCount, kaynak başına 100 satır sınırı yüzünden
/// çok hareketli hesaplarda alt sınırdır (başlıktaki "12 kişi", alttaki "38 aktivite" için yeterli).
/// </summary>
public record FriendsActivityDto(
    int FollowingCount,
    int WeeklyActiveFriendCount,
    int WeeklyActivityCount,
    FriendActivityDto? Spotlight,
    List<FriendActivityDto> Items
);

public record GetFriendsActivityQuery(Guid UserId, string Lang = "en") : IRequest<FriendsActivityDto>;

public class GetFriendsActivityQueryHandler : IRequestHandler<GetFriendsActivityQuery, FriendsActivityDto>
{
    private const int WindowDays = 7;
    private const int SpotlightWindowHours = 48;
    private const int PerSourceLimit = 100;
    private const int ItemCount = 4;
    private const int ExcerptLength = 220;

    private readonly IApplicationDbContext _context;
    public GetFriendsActivityQueryHandler(IApplicationDbContext context) => _context = context;

    private sealed class Agg
    {
        public Guid UserId;
        public Guid MovieId;
        public decimal? Rating;
        public bool Watched;
        public ReactionType? Reaction;
        public string? ReviewContent;
        public bool ContainsSpoiler;
        public DateTime? ReviewAt;
        public DateTime Last;

        public void Touch(DateTime at)
        {
            if (at > Last) Last = at;
        }
    }

    public async Task<FriendsActivityDto> Handle(GetFriendsActivityQuery request, CancellationToken ct)
    {
        var isTr = Localization.IsTurkish(request.Lang);
        var now = DateTime.UtcNow;
        var since = now.AddDays(-WindowDays);

        var friendIds = await _context.Follows.AsNoTracking()
            .Where(f => f.FollowerId == request.UserId
                        && f.FollowingId != request.UserId
                        && f.Following.IsActive)
            .Select(f => f.FollowingId)
            .ToListAsync(ct);

        if (friendIds.Count == 0)
            return new FriendsActivityDto(0, 0, 0, null, new List<FriendActivityDto>());

        // Zaman damgası: puan/tepki/yorum için "son değişiklik" (UpdatedAtUtc ?? CreatedAtUtc),
        // günlük için kaydın OLUŞTURULMA zamanı. Günlükte kullanıcı izleme tarihini kendisi seçip
        // geçmişe dönük kayıt ekleyebildiği için WatchedAtUtc kullanılsaydı, dün eklenen
        // ama 2023 tarihli bir kayıt feed'e hiç girmezdi.
        // DbContext paralel çalışmaz: sorgular sırayla.
        var ratings = await _context.MovieRatings.AsNoTracking()
            .Where(r => friendIds.Contains(r.UserId) && (r.UpdatedAtUtc ?? r.CreatedAtUtc) >= since)
            .OrderByDescending(r => r.UpdatedAtUtc ?? r.CreatedAtUtc)
            .Take(PerSourceLimit)
            .Select(r => new { r.UserId, r.MovieId, r.Value, At = r.UpdatedAtUtc ?? r.CreatedAtUtc })
            .ToListAsync(ct);

        var watches = await _context.WatchHistory.AsNoTracking()
            .Where(w => friendIds.Contains(w.UserId) && w.CreatedAtUtc >= since)
            .OrderByDescending(w => w.CreatedAtUtc)
            .Take(PerSourceLimit)
            .Select(w => new { w.UserId, w.MovieId, w.Rating, At = w.CreatedAtUtc })
            .ToListAsync(ct);

        var reactions = await _context.Likes.AsNoTracking()
            .Where(l => friendIds.Contains(l.UserId) && (l.UpdatedAtUtc ?? l.CreatedAtUtc) >= since)
            .OrderByDescending(l => l.UpdatedAtUtc ?? l.CreatedAtUtc)
            .Take(PerSourceLimit)
            .Select(l => new { l.UserId, l.MovieId, l.Reaction, At = l.UpdatedAtUtc ?? l.CreatedAtUtc })
            .ToListAsync(ct);

        var reviews = await _context.Reviews.AsNoTracking()
            .Where(r => friendIds.Contains(r.UserId) && !r.IsDeleted
                        && (r.UpdatedAtUtc ?? r.CreatedAtUtc) >= since)
            .OrderByDescending(r => r.UpdatedAtUtc ?? r.CreatedAtUtc)
            .Take(PerSourceLimit)
            .Select(r => new { r.UserId, r.MovieId, r.Content, r.ContainsSpoiler, At = r.UpdatedAtUtc ?? r.CreatedAtUtc })
            .ToListAsync(ct);

        // (kullanıcı, film) çiftine göre tek kart: puanladı + günlüğe ekledi + beğendi → tek kayıt.
        var merged = new Dictionary<(Guid UserId, Guid MovieId), Agg>();
        Agg Get(Guid userId, Guid movieId)
        {
            if (!merged.TryGetValue((userId, movieId), out var a))
            {
                a = new Agg { UserId = userId, MovieId = movieId };
                merged[(userId, movieId)] = a;
            }
            return a;
        }

        foreach (var r in ratings)
        {
            var a = Get(r.UserId, r.MovieId);
            a.Rating = r.Value;
            a.Touch(r.At);
        }
        foreach (var w in watches)
        {
            var a = Get(w.UserId, w.MovieId);
            a.Watched = true;
            a.Rating ??= w.Rating;
            a.Touch(w.At);
        }
        foreach (var l in reactions)
        {
            var a = Get(l.UserId, l.MovieId);
            a.Reaction = l.Reaction;
            a.Touch(l.At);
        }
        foreach (var r in reviews)
        {
            var a = Get(r.UserId, r.MovieId);
            a.ReviewContent = r.Content;
            a.ContainsSpoiler = r.ContainsSpoiler;
            a.ReviewAt = r.At;
            a.Touch(r.At);
        }

        if (merged.Count == 0)
            return new FriendsActivityDto(friendIds.Count, 0, 0, null, new List<FriendActivityDto>());

        var movieIds = merged.Values.Select(a => a.MovieId).Distinct().ToList();
        var userIds = merged.Values.Select(a => a.UserId).Distinct().ToList();

        // Silinmiş/pasif kayıtlar burada elenir (soft delete + IsDeleted filtresi).
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
            .Where(u => userIds.Contains(u.Id))
            .Select(u => new { u.Id, u.UserName, u.FullName, u.AvatarUrl })
            .ToDictionaryAsync(u => u.Id, ct);

        var valid = merged.Values
            .Where(a => movies.ContainsKey(a.MovieId) && users.ContainsKey(a.UserId))
            .OrderByDescending(a => a.Last)
            .ToList();

        // Spotlight: son 48 saatteki yorumlu aktivite (spoiler'sız olanlar öncelikli, sonra en yeni);
        // yoksa son 7 günün en yüksek puanlısı (eşitlikte en yeni).
        var reviewCutoff = now.AddHours(-SpotlightWindowHours);
        var spotlightAgg = valid
            .Where(a => !string.IsNullOrWhiteSpace(a.ReviewContent) && a.ReviewAt >= reviewCutoff)
            .OrderBy(a => a.ContainsSpoiler)
            .ThenByDescending(a => a.ReviewAt)
            .FirstOrDefault()
            ?? valid
                .Where(a => a.Rating.HasValue)
                .OrderByDescending(a => a.Rating)
                .ThenByDescending(a => a.Last)
                .FirstOrDefault();

        // Çeşitlilik (Letterboxd mantığı): kartlar önce FARKLI kişilerden seçilir, her kişinin en
        // yeni hareketi öne alınır. Yeterince farklı kişi yoksa kalan yerler aynı kişilerin sıradaki
        // hareketleriyle dolar. Spotlight'taki kişi bir hak kullanmış sayılır, böylece diğer
        // arkadaşlar onun önüne geçer. Seçilenler en sonda zamana göre dizilir.
        var queues = valid
            .Where(a => !ReferenceEquals(a, spotlightAgg))
            .GroupBy(a => a.UserId)
            .ToDictionary(g => g.Key, g => new Queue<Agg>(g)); // valid zaten yeniden eskiye sıralı
        var shownCount = queues.Keys.ToDictionary(k => k, _ => 0);
        if (spotlightAgg is not null && shownCount.ContainsKey(spotlightAgg.UserId))
            shownCount[spotlightAgg.UserId] = 1;

        var itemAggs = new List<Agg>();
        while (itemAggs.Count < ItemCount)
        {
            var nextUser = queues
                .Where(q => q.Value.Count > 0)
                .OrderBy(q => shownCount[q.Key])
                .ThenByDescending(q => q.Value.Peek().Last)
                .Select(q => (Guid?)q.Key)
                .FirstOrDefault();
            if (nextUser is null) break;

            itemAggs.Add(queues[nextUser.Value].Dequeue());
            shownCount[nextUser.Value]++;
        }
        itemAggs = itemAggs.OrderByDescending(a => a.Last).ToList();

        FriendActivityDto Map(Agg a, bool withExcerpt)
        {
            var m = movies[a.MovieId];
            var u = users[a.UserId];
            var hasReview = !string.IsNullOrWhiteSpace(a.ReviewContent);
            var spoiler = hasReview && a.ContainsSpoiler;

            string? excerpt = null;
            if (withExcerpt && hasReview && !spoiler)
            {
                var text = a.ReviewContent!.Trim();
                excerpt = text.Length > ExcerptLength ? text[..ExcerptLength].TrimEnd() + "…" : text;
            }

            return new FriendActivityDto(
                new FriendActivityUserDto(u.Id, u.UserName, u.FullName, u.AvatarUrl),
                new FriendActivityMovieDto(m.Id, m.Title, m.PosterUrl, m.ReleaseYear, m.Genre),
                a.Rating,
                a.Watched,
                a.Reaction?.ToString(),
                hasReview,
                excerpt,
                spoiler,
                a.Last);
        }

        return new FriendsActivityDto(
            friendIds.Count,
            valid.Select(a => a.UserId).Distinct().Count(),
            valid.Count,
            spotlightAgg is null ? null : Map(spotlightAgg, withExcerpt: true),
            itemAggs.Select(a => Map(a, withExcerpt: false)).ToList());
    }
}