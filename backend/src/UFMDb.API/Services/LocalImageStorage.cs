using System.Text.RegularExpressions;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Formats.Png;
using SixLabors.ImageSharp.Formats.Webp;
using SixLabors.ImageSharp.Processing;
using UFMDb.Application.Common.Interfaces;
using ValidationException = UFMDb.Application.Common.Exceptions.ValidationException;

namespace UFMDb.API.Services;

public sealed class LocalImageStorage : IImageStorage
{
    private const long MaxBytes = 5 * 1024 * 1024;
    private const long MaxPixels = 40_000_000;   // decompression bomb koruması
    private const int MaxCoverSide = 1600;
    private const int AvatarSide = 512;

    // Sadece bu üç formatın decoder'ı yüklü. İçerik (magic byte) üzerinden tanınır;
    // uzantı/Content-Type'a güvenilmez. SVG, GIF, BMP, TIFF vb. tanınmaz ve reddedilir.
    private static readonly Configuration DecodeConfig = new(
        new JpegConfigurationModule(), new PngConfigurationModule(), new WebpConfigurationModule());

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
        var options = new DecoderOptions { Configuration = DecodeConfig, MaxFrames = 1 };

        try
        {
            var info = await Image.IdentifyAsync(options, buffer, ct);
            if ((long)info.Width * info.Height > MaxPixels)
                throw Invalid("Görselin çözünürlüğü çok yüksek.");

            buffer.Position = 0;
            using var image = await Image.LoadAsync(options, buffer, ct);

            image.Mutate(x => x.AutoOrient());          // EXIF yönünü uygula, sonra metadata'yı sil
            image.Metadata.ExifProfile = null;           // GPS dahil
            image.Metadata.IccProfile = null;
            image.Metadata.IptcProfile = null;
            image.Metadata.XmpProfile = null;

            if (kind == ImageKind.Avatar)
            {
                image.Mutate(x => x.Resize(new ResizeOptions
                {
                    Size = new Size(AvatarSide, AvatarSide),
                    Mode = ResizeMode.Crop
                }));
            }
            else if (image.Width > MaxCoverSide || image.Height > MaxCoverSide)
            {
                image.Mutate(x => x.Resize(new ResizeOptions
                {
                    Size = new Size(MaxCoverSide, MaxCoverSide),
                    Mode = ResizeMode.Max
                }));
            }

            var dir = kind == ImageKind.Avatar ? "avatars" : "covers";
            var folder = Path.Combine(_root, dir);
            Directory.CreateDirectory(folder);

            var fileName = $"{Guid.NewGuid():N}.webp";   // ad tamamen bizim ürettiğimiz değer
            var path = Path.Combine(folder, fileName);

            try
            {
                await using (var fs = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None))
                {
                    await image.SaveAsWebpAsync(fs, new WebpEncoder { Quality = 82, FileFormat = WebpFileFormatType.Lossy }, ct);
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
        catch (Exception ex) when (ex is ImageFormatException or ImageProcessingException or NotSupportedException)
        {
            throw Invalid("Geçersiz veya desteklenmeyen görsel. Sadece JPG, PNG ve WebP yüklenebilir.");
        }
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