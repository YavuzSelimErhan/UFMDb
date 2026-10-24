using Microsoft.AspNetCore.Http;

namespace UFMDb.API;

/// <summary>
/// İsteğin dilini belirler. Öncelik sırası:
/// 1) ?lang=tr sorgu parametresi, 2) Accept-Language başlığı, 3) varsayılan "en".
/// Dönen değer her zaman "tr" veya "en"dir (Localization.IsTurkish ile uyumlu).
/// </summary>
public static class RequestLanguageExtensions
{
    public static string GetLang(this HttpRequest request)
    {
        var fromQuery = request.Query["lang"].ToString();
        if (!string.IsNullOrWhiteSpace(fromQuery))
            return Normalize(fromQuery);

        var header = request.Headers["Accept-Language"].ToString();
        if (!string.IsNullOrWhiteSpace(header))
            return Normalize(header.Split(',')[0]);

        return "en";
    }

    private static string Normalize(string value)
    {
        var s = value.Trim().ToLowerInvariant();
        var cut = s.IndexOfAny(new[] { '-', '_', ';' });
        if (cut > 0) s = s[..cut];
        return s == "tr" ? "tr" : "en";
    }
}