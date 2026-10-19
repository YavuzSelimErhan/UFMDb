using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using UFMDb.Application.Common.Interfaces;

namespace UFMDb.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]   // sınıf düzeyi: giriş zorunlu; admin endpoint'i ayrıca Roles ile daralır (ikisi birlikte aranır)
public class UploadsController : ControllerBase
{
    private const long MaxRequestBytes = 6 * 1024 * 1024; // 5 MB dosya + multipart zarfı

    private readonly IWebHostEnvironment _env;
    private readonly IImageStorage _images;

    public UploadsController(IWebHostEnvironment env, IImageStorage images)
    {
        _env = env;
        _images = images;
    }

    private static readonly string[] AllowedExtensions = { ".jpg", ".jpeg", ".png", ".webp", ".gif" };
    private const long MaxFileSizeBytes = 5 * 1024 * 1024;

    /// <summary>Liste kapağı: her giriş yapmış kullanıcı. Doğrulanır, yeniden encode edilir.</summary>
    [HttpPost("cover")]
    [EnableRateLimiting("ImageUpload")]
    [RequestSizeLimit(MaxRequestBytes)]
    public async Task<IActionResult> UploadCover(IFormFile file, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            return BadRequest("Dosya seçilmedi.");

        await using var stream = file.OpenReadStream();
        var url = await _images.SaveAsync(stream, ImageKind.Cover, ct);
        return Ok(new { url });
    }

    /// <summary>Admin'in film/oyuncu/yönetmen görselleri için mevcut endpoint (değişmedi).</summary>
    [HttpPost("image")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UploadImage(IFormFile file)
    {
        if (file is null || file.Length == 0)
            return BadRequest("Dosya seçilmedi.");

        if (file.Length > MaxFileSizeBytes)
            return BadRequest("Dosya boyutu 5 MB'ı geçemez.");

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!AllowedExtensions.Contains(extension))
            return BadRequest("Sadece jpg, png, webp veya gif dosyaları yüklenebilir.");

        var fileName = $"{Guid.NewGuid()}{extension}";

        var webRoot = _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
        var uploadsFolder = Path.Combine(webRoot, "uploads", "images");
        Directory.CreateDirectory(uploadsFolder);

        var filePath = Path.Combine(uploadsFolder, fileName);
        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        var relativeUrl = $"/api/uploads/images/{fileName}";
        return Ok(new { url = relativeUrl });
    }
}