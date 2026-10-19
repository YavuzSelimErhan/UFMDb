using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common.Interfaces;
using ValidationException = UFMDb.Application.Common.Exceptions.ValidationException;

namespace UFMDb.Application.Features.Lists;

/// <summary>Liste kapağı olarak kabul edilen URL'lerin tek kural kaynağı.</summary>
internal static class CoverImagePolicy
{
    // Yeni yüklemeler: /api/uploads/covers/{32 hex}.webp
    // Eski admin yüklemeleri: /api/uploads/images/{guid}.{ext}
    private static readonly Regex LocalUpload = new(
        @"^/api/uploads/(covers|images)/[0-9a-fA-F-]{32,36}\.(webp|jpe?g|png|gif)\z",
        RegexOptions.Compiled);

    public static bool IsLocalUpload(string? url) => !string.IsNullOrEmpty(url) && LocalUpload.IsMatch(url);

    /// <summary>Validator için sadece biçim kontrolü; asıl yetki kararı Resolve'da.</summary>
    public static bool IsAcceptableShape(string? url) =>
        string.IsNullOrEmpty(url)
        || IsLocalUpload(url)
        || (Uri.TryCreate(url, UriKind.Absolute, out var uri)
            && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps));

    /// <summary>
    /// Kaydedilecek kapak değerini döndürür. Boş veya kendi yüklenen dosya olabilir.
    /// Dış link sadece "zaten kayıtlı olan değer değişmediyse" (eski veri) geçer; yeni dış link reddedilir.
    /// </summary>
    public static string Resolve(string? incoming, string? current)
    {
        var url = incoming?.Trim() ?? string.Empty;
        if (url.Length == 0) return string.Empty;
        if (IsLocalUpload(url)) return url;
        if (url == current) return url;
        throw new ValidationException("CoverImageUrl", "Kapak görseli yalnızca yüklenen bir dosya olabilir.");
    }

    /// <summary>Başka bir listede kullanılmıyorsa dosyayı siler (silinmiş listeler de "kullanıyor" sayılır).</summary>
    public static async Task DeleteIfUnusedAsync(
        IApplicationDbContext ctx, IImageStorage images, string? url, Guid exceptListId, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(url)) return;
        var stillUsed = await ctx.CuratedLists.IgnoreQueryFilters().AsNoTracking()
            .AnyAsync(cl => cl.Id != exceptListId && cl.CoverImageUrl == url, ct);
        if (!stillUsed) images.Delete(url);
    }
}