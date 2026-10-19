using System.Text.RegularExpressions;

namespace UFMDb.Application.Features.Lists;

/// <summary>Liste kapak adresi kuralı: sıradan kullanıcı sadece kendi yüklediği (LocalImageStorage) kapağı kullanabilir.</summary>
public static class ListCoverPolicy
{
    // LocalImageStorage'ın kapaklar için ürettiği biçim.
    private static readonly Regex Managed = new(
        @"^/api/uploads/covers/[0-9a-f]{32}\.webp\z", RegexOptions.Compiled);

    // Admin endpoint'inin (/api/uploads/image) ürettiği eski dosyalar.
    private static readonly Regex LegacyAdmin = new(
        @"^/api/uploads/images/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|gif)\z",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    /// <param name="privileged">Admin ya da resmi liste: eski admin yüklemeleri ve harici http(s) adresi de kabul edilir.</param>
    public static bool IsAllowed(string? url, bool privileged)
    {
        if (string.IsNullOrEmpty(url)) return true;
        if (Managed.IsMatch(url)) return true;
        if (!privileged) return false;
        if (LegacyAdmin.IsMatch(url)) return true;

        return Uri.TryCreate(url, UriKind.Absolute, out var uri)
               && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);
    }
}