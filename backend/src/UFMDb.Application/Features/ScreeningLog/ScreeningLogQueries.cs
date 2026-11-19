using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Globalization;
using UFMDb.Application.Common;
using UFMDb.Application.Common.Interfaces;
using ReactionType = UFMDb.Domain.Enums.ReactionType;

namespace UFMDb.Application.Features.Users;

// ScreeningLogEntryDto ve ScreeningLogDayDto Users dosyasında olduğu gibi kalıyor.
// Eski GetScreeningLogQuery + GetScreeningLogQueryHandler bloğu o dosyadan SİLİNMELİ (bu dosya yerine geçiyor).

/// <summary>Bir sayfa gün + bir sonraki sayfa için imleç (null = liste bitti).</summary>
public record ScreeningLogPageDto(List<ScreeningLogDayDto> Days, string? NextCursor);

/// <param name="Cursor">Önceki sayfanın son gününün tarihi (yyyy-MM-dd); bu günden ESKİ günler döner.</param>
public record GetScreeningLogQuery(
    Guid UserId,
    string? Cursor = null,
    int PageSize = 20,
    ReactionType? Reaction = null,
    string? Search = null,
    string Lang = "en") : IRequest<ScreeningLogPageDto>;

public class GetScreeningLogQueryHandler : IRequestHandler<GetScreeningLogQuery, ScreeningLogPageDto>
{
    private const int DefaultPageSize = 20;
    private const int MaxPageSize = 60;
    private const int MaxSearchLength = 100;

    private readonly IApplicationDbContext _context;
    public GetScreeningLogQueryHandler(IApplicationDbContext context) => _context = context;

    public async Task<ScreeningLogPageDto> Handle(GetScreeningLogQuery request, CancellationToken ct)
    {
        var userId = request.UserId;
        var isTr = Localization.IsTurkish(request.Lang);
        var pageSize = request.PageSize is < 1 or > MaxPageSize ? DefaultPageSize : request.PageSize;

        var query = _context.WatchHistory.AsNoTracking().Where(w => w.UserId == userId);

        // Filtre ve arama sunucuda: sayfalamayla eski sayfalardaki eşleşmeler kaçmasın.
        if (request.Reaction.HasValue)
        {
            var reaction = request.Reaction.Value;
            query = query.Where(w => _context.Likes.Any(l =>
                l.UserId == userId && l.MovieId == w.MovieId && l.Reaction == reaction));
        }

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var term = request.Search.Trim();
            if (term.Length > MaxSearchLength) term = term[..MaxSearchLength];
            var pattern = $"%{SqlLike.Escape(term)}%";
            // Dilden ve aksandan bağımsız: İngilizce, orijinal ve Türkçe başlıkların hepsinde aranır.
            query = query.Where(w =>
                EF.Functions.ILike(EF.Functions.Unaccent(w.Movie.Title), EF.Functions.Unaccent(pattern), SqlLike.EscapeCharacter) ||
                EF.Functions.ILike(EF.Functions.Unaccent(w.Movie.OriginalTitle), EF.Functions.Unaccent(pattern), SqlLike.EscapeCharacter) ||
                EF.Functions.ILike(EF.Functions.Unaccent(w.Movie.TitleTr), EF.Functions.Unaccent(pattern), SqlLike.EscapeCharacter));
        }

        if (!string.IsNullOrWhiteSpace(request.Cursor))
        {
            if (!DateOnly.TryParseExact(request.Cursor, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var cursorDate))
                throw new UFMDb.Application.Common.Exceptions.ValidationException(new Dictionary<string, string[]>
                {
                    ["Cursor"] = new[] { "Geçersiz imleç değeri." }
                });

            var cursorStart = DateTime.SpecifyKind(cursorDate.ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc);
            query = query.Where(w => w.WatchedAtUtc < cursorStart);
        }

        // 1) Bu sayfanın günleri (yeni → eski). Bir fazlasını isteyip "daha var mı"yı öğreniyoruz.
        var dayRows = await query
            .Select(w => w.WatchedAtUtc.Date)
            .Distinct()
            .OrderByDescending(d => d)
            .Take(pageSize + 1)
            .ToListAsync(ct);

        var hasMore = dayRows.Count > pageSize;
        var days = dayRows.Take(pageSize).ToList();
        if (days.Count == 0)
            return new ScreeningLogPageDto(new List<ScreeningLogDayDto>(), null);

        var lower = DateTime.SpecifyKind(days.Min(), DateTimeKind.Utc);
        var upper = DateTime.SpecifyKind(days.Max().AddDays(1), DateTimeKind.Utc);

        // 2) Yalnızca bu günlerin seansları, düz projeksiyonla (Include yok).
        var entries = await query
            .Where(w => w.WatchedAtUtc >= lower && w.WatchedAtUtc < upper)
            .OrderByDescending(w => w.WatchedAtUtc).ThenByDescending(w => w.CreatedAtUtc).ThenByDescending(w => w.Id)
            .Select(w => new
            {
                w.Id,
                w.MovieId,
                Title = isTr && w.Movie.TitleTr != "" ? w.Movie.TitleTr : w.Movie.Title,
                w.Movie.PosterUrl,
                w.WatchedAtUtc,
                w.Rating
            })
            .ToListAsync(ct);

        var movieIds = entries.Select(e => e.MovieId).Distinct().ToList();

        // 3) Sadece bu sayfadaki filmler için inceleme, tepki ve "kaçıncı izleme" bilgisi.
        var reviews = (await _context.Reviews.AsNoTracking()
            .Where(r => r.UserId == userId && !r.IsDeleted && movieIds.Contains(r.MovieId))
            .Select(r => new { r.MovieId, r.Content, r.ContainsSpoiler })
            .ToListAsync(ct)).ToDictionary(r => r.MovieId);

        var reactions = await _context.Likes.AsNoTracking()
            .Where(l => l.UserId == userId && movieIds.Contains(l.MovieId))
            .ToDictionaryAsync(l => l.MovieId, l => l.Reaction, ct);

        // Rewatch numarası tüm geçmişe göre hesaplanır (filtre/sayfa ne olursa olsun tutarlı kalır).
        var history = await _context.WatchHistory.AsNoTracking()
            .Where(w => w.UserId == userId && movieIds.Contains(w.MovieId))
            .Select(w => new { w.Id, w.MovieId, w.WatchedAtUtc, w.CreatedAtUtc })
            .ToListAsync(ct);

        var screeningNumbers = new Dictionary<Guid, int>();
        foreach (var group in history.GroupBy(h => h.MovieId))
        {
            var n = 0;
            foreach (var h in group.OrderBy(h => h.WatchedAtUtc).ThenBy(h => h.CreatedAtUtc).ThenBy(h => h.Id))
                screeningNumbers[h.Id] = ++n;
        }

        var dtos = entries.Select(e =>
        {
            reviews.TryGetValue(e.MovieId, out var review);
            return new ScreeningLogEntryDto(
                e.Id, e.MovieId, e.Title, e.PosterUrl, e.WatchedAtUtc,
                screeningNumbers.TryGetValue(e.Id, out var number) ? number : 1,
                e.Rating,
                review?.Content,
                reactions.TryGetValue(e.MovieId, out var r) ? r : (ReactionType?)null,
                review?.ContainsSpoiler ?? false);
        });

        var result = dtos
            .GroupBy(e => e.WatchedAtUtc.Date)
            .OrderByDescending(g => g.Key)
            .Select(g => new ScreeningLogDayDto(g.Key, g.ToList()))
            .ToList();

        var nextCursor = hasMore ? days[^1].ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) : null;
        return new ScreeningLogPageDto(result, nextCursor);
    }
}

// ---------- Özet istatistikler: sayfalamadan bağımsız, tüm günlük üzerinden ----------
public record ScreeningLogSummaryDto(
    int TotalScreenings,
    int UniqueFilms,
    int RatedScreenings,
    decimal? AverageRating,
    int LikedFilms,
    int NotForMeFilms);

public record GetScreeningLogSummaryQuery(Guid UserId) : IRequest<ScreeningLogSummaryDto>;

public class GetScreeningLogSummaryQueryHandler : IRequestHandler<GetScreeningLogSummaryQuery, ScreeningLogSummaryDto>
{
    private readonly IApplicationDbContext _context;
    public GetScreeningLogSummaryQueryHandler(IApplicationDbContext context) => _context = context;

    public async Task<ScreeningLogSummaryDto> Handle(GetScreeningLogSummaryQuery request, CancellationToken ct)
    {
        var userId = request.UserId;
        var history = _context.WatchHistory.AsNoTracking().Where(w => w.UserId == userId);

        var total = await history.CountAsync(ct);
        if (total == 0)
            return new ScreeningLogSummaryDto(0, 0, 0, null, 0, 0);

        var unique = await history.Select(w => w.MovieId).Distinct().CountAsync(ct);
        var rated = await history.CountAsync(w => w.Rating.HasValue, ct);
        var avg = rated > 0
            ? await history.Where(w => w.Rating.HasValue).AverageAsync(w => w.Rating, ct)
            : null;

        // Beğeni / "bana göre değil" sayıları film bazında (yeniden izlenen film tek sayılır).
        var liked = await _context.Likes.AsNoTracking().CountAsync(l =>
            l.UserId == userId && l.Reaction == ReactionType.Like &&
            _context.WatchHistory.Any(w => w.UserId == userId && w.MovieId == l.MovieId), ct);
        var notForMe = await _context.Likes.AsNoTracking().CountAsync(l =>
            l.UserId == userId && l.Reaction == ReactionType.Dislike &&
            _context.WatchHistory.Any(w => w.UserId == userId && w.MovieId == l.MovieId), ct);

        return new ScreeningLogSummaryDto(
            total, unique, rated, avg.HasValue ? Math.Round(avg.Value, 1) : null, liked, notForMe);
    }
}