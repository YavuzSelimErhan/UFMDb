using System.Globalization;
using System.Text;
using MediatR;
using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Application.Common.Services;

namespace UFMDb.Application.Features.Users;

public record WatchlistFileDto(string FileName, byte[] Content);

/// <summary>Kullanıcının watchlist'ini CSV (UTF-8 BOM'lu, Excel uyumlu) olarak üretir.</summary>
public record ExportWatchlistQuery(Guid UserId) : IRequest<WatchlistFileDto>;

public class ExportWatchlistQueryHandler : IRequestHandler<ExportWatchlistQuery, WatchlistFileDto>
{
    private const string Header = "title,year,tmdb_id,imdb_id,added_at";

    private readonly IApplicationDbContext _context;
    public ExportWatchlistQueryHandler(IApplicationDbContext context) => _context = context;

    public async Task<WatchlistFileDto> Handle(ExportWatchlistQuery request, CancellationToken ct)
    {
        // Başlık İngilizce yazılır: dosya dilden bağımsız ve IMDb/Letterboxd ile uyumlu kalır.
        var rows = await _context.WatchlistItems.AsNoTracking()
            .Where(w => w.UserId == request.UserId && !w.Movie.IsDeleted)
            .OrderByDescending(w => w.CreatedAtUtc).ThenBy(w => w.Id)
            .Select(w => new
            {
                w.Movie.Title,
                w.Movie.ReleaseYear,
                w.Movie.TmdbId,
                w.Movie.ImdbId,
                w.CreatedAtUtc
            })
            .ToListAsync(ct);

        var sb = new StringBuilder(Header.Length + rows.Count * 80);
        sb.Append(Header).Append("\r\n");

        foreach (var r in rows)
        {
            sb.Append(CsvFormat.Field(r.Title)).Append(',')
              .Append(r.ReleaseYear > 0 ? r.ReleaseYear.ToString(CultureInfo.InvariantCulture) : "").Append(',')
              .Append(r.TmdbId?.ToString(CultureInfo.InvariantCulture) ?? "").Append(',')
              .Append(r.ImdbId ?? "").Append(',')
              .Append(r.CreatedAtUtc.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture))
              .Append("\r\n");
        }

        // BOM: Excel'in dosyayı UTF-8 olarak açıp Türkçe karakterleri bozmaması için.
        var utf8 = new UTF8Encoding(encoderShouldEmitUTF8Identifier: true);
        var preamble = utf8.GetPreamble();
        var body = utf8.GetBytes(sb.ToString());
        var content = new byte[preamble.Length + body.Length];
        Buffer.BlockCopy(preamble, 0, content, 0, preamble.Length);
        Buffer.BlockCopy(body, 0, content, preamble.Length, body.Length);

        var fileName = $"ufmdb-watchlist-{DateTime.UtcNow:yyyy-MM-dd}.csv";
        return new WatchlistFileDto(fileName, content);
    }
}