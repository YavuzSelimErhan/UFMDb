namespace UFMDb.Application.Common.Interfaces;

public enum ImageKind { Cover, Avatar }

public interface IImageStorage
{
    /// <summary>
    /// Görseli doğrular, yeniden encode eder ve kaydeder. Geriye göreli URL döner.
    /// Geçersiz dosyada ValidationException fırlatır.
    /// </summary>
    Task<string> SaveAsync(Stream source, ImageKind kind, CancellationToken ct = default);

    /// <summary>Sadece bu servisin ürettiği dosyaları siler; başka bir URL verilirse hiçbir şey yapmaz.</summary>
    void Delete(string? url);
}