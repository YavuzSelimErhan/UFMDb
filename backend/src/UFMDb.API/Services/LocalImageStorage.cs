using System.Text.RegularExpressions;
using ImageMagick;
using UFMDb.Application.Common.Interfaces;
using ValidationException = UFMDb.Application.Common.Exceptions.ValidationException;

namespace UFMDb.API.Services;

public sealed class LocalImageStorage : IImageStorage
{
    private const long MaxBytes = 5 * 1024 * 1024;
    private const long MaxPixels = 40_000_000;   // decompression bomb koruması
    private const int MaxCoverSide = 1600;
    private const int AvatarSide = 512;

    // Sadece kendi ürettiğimiz dosya adı biçimi silinebilir; eski dosyalara ve dış URL'lere dokunulmaz.
    private static readonly Regex ManagedUrl = new(
        @"^/api/uploads/(?<dir>covers|avatars)/(?<file>[0-9a-f]{32}\.webp)\z", RegexOptions.Compiled);

    private readonly string _root;
    private readonly ILogger<LocalImageStorage> _logger;

    public LocalImageStorage(IWebHostEnvironment env, ILogger<LocalImageStorage> logger)
    {
        _root = Path.Combine(env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot"), "uploads");
        _logger = logger;
    }

    public async Task<string> SaveAsync(Stream source, ImageKind kind, CancellationToken ct = default)
    {
        using var buffer = await ReadLimitedAsync(source, ct);
        var settings = new MagickReadSettings { Format = DetectFormat(buffer), FrameCount = 1 };

        try
        {
            var info = new MagickImageInfo(buffer, settings);
            if ((ulong)info.Width * info.Height > MaxPixels)
                throw Invalid("Görselin çözünürlüğü çok yüksek.");

            ct.ThrowIfCancellationRequested();
            buffer.Position = 0;
            using var image = new MagickImage(buffer, settings);
            image.AutoOrient();
            image.Strip();

            if (kind == ImageKind.Avatar)
            {
                var side = Math.Min(image.Width, image.Height);
                image.Crop(side, side, Gravity.Center);
                image.ResetPage();
                image.Resize(AvatarSide, AvatarSide);
            }
            else if (image.Width > MaxCoverSide || image.Height > MaxCoverSide)
            {
                image.Resize(MaxCoverSide, MaxCoverSide);
            }
            image.Quality = 82;
            ct.ThrowIfCancellationRequested();

            var dir = kind == ImageKind.Avatar ? "avatars" : "covers";
            var folder = Path.Combine(_root, dir);
            Directory.CreateDirectory(folder);

            var fileName = $"{Guid.NewGuid():N}.webp";   // ad tamamen bizim ürettiğimiz değer
            var path = Path.Combine(folder, fileName);

            try
            {
                await using (var fs = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None))
                {
                    image.Write(fs, MagickFormat.WebP);
                    ct.ThrowIfCancellationRequested();
                }
            }
            catch
            {
                // Encode yarıda kesildi / iptal edildi: yarım dosya diskte kalmasın.
                TryDeleteFile(path);
                throw;
            }

            return $"/api/uploads/{dir}/{fileName}";
        }
        catch (MagickException)
        {
            throw Invalid("Geçersiz veya desteklenmeyen görsel. Sadece JPG, PNG ve WebP yüklenebilir.");
        }
    }

    private static MagickFormat DetectFormat(MemoryStream buffer)
    {
        var bytes = buffer.GetBuffer().AsSpan(0, (int)buffer.Length);
        if (bytes.StartsWith((ReadOnlySpan<byte>)[0xff, 0xd8, 0xff])) return MagickFormat.Jpeg;
        if (bytes.StartsWith((ReadOnlySpan<byte>)[0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10])) return MagickFormat.Png;
        if (bytes.Length >= 12 && bytes.StartsWith("RIFF"u8) && bytes.Slice(8, 4).SequenceEqual("WEBP"u8))
            return MagickFormat.WebP;
        throw Invalid("Sadece JPG, PNG ve WebP yüklenebilir.");
    }

    public void Delete(string? url)
    {
        if (string.IsNullOrEmpty(url)) return;
        var m = ManagedUrl.Match(url);
        if (!m.Success) return;

        TryDeleteFile(Path.Combine(_root, m.Groups["dir"].Value, m.Groups["file"].Value));
    }

    private void TryDeleteFile(string path)
    {
        try
        {
            File.Delete(path);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            _logger.LogWarning(ex, "Yüklenen dosya silinemedi: {Path}", path);
        }
    }

    private static async Task<MemoryStream> ReadLimitedAsync(Stream source, CancellationToken ct)
    {
        var ms = new MemoryStream();
        var chunk = new byte[81920];
        int read;
        while ((read = await source.ReadAsync(chunk, ct)) > 0)
        {
            if (ms.Length + read > MaxBytes) { ms.Dispose(); throw Invalid("Dosya boyutu 5 MB'ı geçemez."); }
            ms.Write(chunk, 0, read);
        }
        if (ms.Length == 0) { ms.Dispose(); throw Invalid("Dosya seçilmedi."); }
        ms.Position = 0;
        return ms;
    }

    private static ValidationException Invalid(string message) => new("file", message);
}