using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common.Exceptions;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Domain.Entities;
using UFMDb.Domain.Enums;

namespace UFMDb.Application.Features.Lists;

internal static class ListLimits
{
    public const int MaxListsPerUser = 100;
    public const int MaxItemsPerList = 500;
}

/// <summary>Bir listeyi kimin görebileceği / düzenleyebileceği tek yerde tanımlı.</summary>
internal static class ListAccess
{
    // Sahibi, admin veya (yayında + private değil) ise görebilir. Silinmiş liste kimseye görünmez.
    public static IQueryable<CuratedList> VisibleTo(this IQueryable<CuratedList> q, Guid? viewerId, bool isAdmin)
    {
        var vid = viewerId ?? Guid.Empty;
        return q.Where(cl => !cl.IsDeleted && (
            isAdmin
            || cl.CreatedByUserId == vid
            || (cl.Status == ListStatus.Published && cl.Visibility != ListVisibility.Private)));
    }

    public static bool CanView(CuratedList cl, Guid? viewerId, bool isAdmin) =>
        !cl.IsDeleted && (
            isAdmin
            || (viewerId.HasValue && cl.CreatedByUserId == viewerId.Value)
            || (cl.Status == ListStatus.Published && cl.Visibility != ListVisibility.Private));

    // Keşif sayfalarında (resmi / topluluk) görünecek mi? Unlisted bilerek hariç.
    public static bool IsDiscoverable(CuratedList cl) =>
        !cl.IsDeleted && cl.Status == ListStatus.Published && cl.Visibility == ListVisibility.Public;

    public static void EnsureCanEdit(CuratedList list, Guid userId, bool isAdmin)
    {
        if (list.CreatedByUserId != userId && !isAdmin)
            throw new ForbiddenException("Bu listeyi düzenleme yetkin yok.");
        if (list.IsOfficial && !isAdmin)
            throw new ForbiddenException("Resmi koleksiyonları sadece admin düzenleyebilir.");
    }
}

internal static class SlugGenerator
{
    private static readonly Regex NonAlnum = new("[^a-z0-9]+", RegexOptions.Compiled);
    private static readonly HashSet<string> Reserved = new(StringComparer.Ordinal) { "new", "edit", "by-slug", "for-movie" };

    public static string Slugify(string text)
    {
        // Türkçe karakterleri önce elle çevir (İ/ı lower-case'i kültüre göre değişir).
        var s = text.Trim()
            .Replace('ı', 'i').Replace('İ', 'i').Replace('ğ', 'g').Replace('Ğ', 'g')
            .Replace('ü', 'u').Replace('Ü', 'u').Replace('ş', 's').Replace('Ş', 's')
            .Replace('ö', 'o').Replace('Ö', 'o').Replace('ç', 'c').Replace('Ç', 'c')
            .ToLowerInvariant();

        // Kalan aksanları (é, ñ, ...) temizle.
        var sb = new StringBuilder();
        foreach (var c in s.Normalize(NormalizationForm.FormD))
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
                sb.Append(c);

        s = NonAlnum.Replace(sb.ToString().Normalize(NormalizationForm.FormC), "-").Trim('-');
        if (s.Length > 80) s = s[..80].TrimEnd('-');
        return s.Length == 0 ? "list" : s;
    }

    /// <summary>Çakışırsa -2, -3 ekler. Soft-delete edilmiş listelerin slug'ları da dolu sayılır (unique index hepsini kapsıyor).</summary>
    public static async Task<string> GenerateUniqueAsync(IApplicationDbContext ctx, string title, CancellationToken ct)
    {
        var baseSlug = Slugify(title);
        if (Reserved.Contains(baseSlug)) baseSlug += "-list";
        var taken = (await ctx.CuratedLists.IgnoreQueryFilters().AsNoTracking()
            .Where(cl => cl.Slug.StartsWith(baseSlug))
            .Select(cl => cl.Slug)
            .ToListAsync(ct)).ToHashSet(StringComparer.Ordinal);

        if (!taken.Contains(baseSlug)) return baseSlug;
        for (var n = 2; ; n++)
        {
            var candidate = $"{baseSlug}-{n}";
            if (!taken.Contains(candidate)) return candidate;
        }
    }

    /// <summary>Yarış durumunda yedek: rastgele kısa sonek.</summary>
    public static string WithRandomSuffix(string title) =>
        $"{Slugify(title)}-{Guid.NewGuid():N}"[..(Slugify(title).Length + 7)];
}

internal static class ListItemsHelper
{
    /// <summary>Aynı film iki kez gelirse ilkini tutar (composite key çakışmasın), filmlerin varlığını doğrular, notları temizler.</summary>
    public static async Task<List<ListItemInput>> NormalizeAsync(
        IApplicationDbContext ctx, IEnumerable<ListItemInput> items, CancellationToken ct)
    {
        var distinct = items
            .GroupBy(i => i.MovieId)
            .Select(g => g.First())
            .Select(i => i with { Note = Clean(i.Note), NoteTr = Clean(i.NoteTr) })
            .ToList();

        var ids = distinct.Select(i => i.MovieId).ToList();
        var existing = (await ctx.Movies.AsNoTracking()
            .Where(m => ids.Contains(m.Id)).Select(m => m.Id).ToListAsync(ct)).ToHashSet();

        var missing = ids.FirstOrDefault(id => !existing.Contains(id));
        if (missing != Guid.Empty) throw new NotFoundException(nameof(Movie), missing);

        return distinct;
    }

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}

internal static class ListNotifications
{
    /// <summary>
    /// Sadece herkese açık + yayında + en az bir filmi olan kullanıcı listeleri için takipçilere "yeni liste" bildirimi.
    /// Aynı liste için ikinci kez üretmez (private/public arasında gidip gelerek spam yapılamasın).
    /// </summary>
    public static async Task NotifyFollowersAsync(IApplicationDbContext ctx, CuratedList list, CancellationToken ct)
    {
        if (list.IsOfficial || list.ItemCount == 0 || !ListAccess.IsDiscoverable(list)) return;

        var alreadyNotified = await ctx.Notifications.AnyAsync(n =>
            n.EntityId == list.Id && n.Type == NotificationType.ListCreated, ct);
        if (alreadyNotified) return;

        var followerIds = await ctx.Follows.AsNoTracking()
            .Where(f => f.FollowingId == list.CreatedByUserId && f.Follower.IsActive)
            .Select(f => f.FollowerId)
            .ToListAsync(ct);
        if (followerIds.Count == 0) return;

        ctx.Notifications.AddRange(followerIds.Select(followerId => new Notification
        {
            RecipientUserId = followerId,
            ActorUserId = list.CreatedByUserId,
            Type = NotificationType.ListCreated,
            EntityId = list.Id,
        }));
        await ctx.SaveChangesAsync(ct);
    }
}