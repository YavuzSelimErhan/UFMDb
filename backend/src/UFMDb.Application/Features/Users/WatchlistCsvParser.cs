using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using CsvHelper;
using CsvHelper.Configuration;
using UFMDb.Application.Common.Exceptions;
using UFMDb.Application.Common.Services;
using ValidationException = UFMDb.Application.Common.Exceptions.ValidationException;

namespace UFMDb.Application.Features.Users;

public record WatchlistCsvRow(int RowNumber, string? ImdbId, int? TmdbId, string? Title, int? Year);
public record ParsedWatchlist(List<WatchlistCsvRow> Rows, int InvalidRows);

/// <summary>
/// UFMDb, IMDb ve Letterboxd watchlist dosyalarını okur. Ayraç (, ; sekme) ve kodlama
/// (UTF-8 / Windows-1254) otomatik bulunur; sütunlar başlık adına göre eşleşir.
/// </summary>
public static class WatchlistCsvParser
{
    public const int MaxRows = 2000;
    private const int MaxTitleLength = 300;

    private static readonly Regex ImdbPattern = new(@"^tt\d{6,10}$", RegexOptions.Compiled);

    static WatchlistCsvParser() => Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);

    public static ParsedWatchlist Parse(byte[] bytes)
    {
        // NUL baytı ikili dosya demektir (xlsx, UTF-16 metin vb.).
        if (Array.IndexOf(bytes, (byte)0) >= 0)
            throw new ValidationException("File",
                "Geçerli bir CSV dosyası değil. Excel'de \"CSV UTF-8\" olarak kaydetmeyi dene.");

        var text = Decode(bytes).TrimStart('\uFEFF');

        // Excel bazen ilk satıra "sep=;" yazar.
        if (text.StartsWith("sep=", StringComparison.OrdinalIgnoreCase))
        {
            var nl = text.IndexOf('\n');
            text = nl < 0 ? "" : text[(nl + 1)..];
        }

        if (string.IsNullOrWhiteSpace(text))
            throw new ValidationException("File", "Dosya boş.");

        var config = new CsvConfiguration(CultureInfo.InvariantCulture)
        {
            Delimiter = DetectDelimiter(text),
            HasHeaderRecord = true,
            BadDataFound = null,
            MissingFieldFound = null,
            HeaderValidated = null,
            TrimOptions = TrimOptions.Trim,
            DetectColumnCountChanges = false,
            IgnoreBlankLines = true
        };

        var rows = new List<WatchlistCsvRow>();
        var invalid = 0;
        var total = 0;

        try
        {
            using var reader = new StringReader(text);
            using var csv = new CsvReader(reader, config);

            if (!csv.Read() || !csv.ReadHeader())
                throw new ValidationException("File", "Dosya boş.");

            var norm = (csv.HeaderRecord ?? Array.Empty<string>()).Select(NormalizeHeader).ToArray();
            int Find(params string[] names) => Array.FindIndex(norm, n => names.Contains(n));

            var iImdb = Find("imdbid", "const", "imdb");
            var iTmdb = Find("tmdbid", "tmdb");
            var iTitle = Find("title", "name", "filmadi", "filmadı", "baslik", "başlık");
            var iYear = Find("year", "releaseyear", "yil", "yıl");

            if (iImdb < 0 && iTmdb < 0 && iTitle < 0)
                throw new ValidationException("File",
                    "Tanınan bir sütun bulunamadı. Beklenen sütunlar: title, year, imdb_id, tmdb_id.");

            while (csv.Read())
            {
                string? Field(int i) =>
                    i >= 0 && i < csv.Parser.Count ? CsvFormat.Unescape(csv.GetField(i))?.Trim() : null;

                var imdbRaw = Field(iImdb);
                var tmdbRaw = Field(iTmdb);
                var titleRaw = Field(iTitle);
                var yearRaw = Field(iYear);

                // Tamamen boş satırlar (",,,") sayılmaz.
                if (string.IsNullOrWhiteSpace(imdbRaw) && string.IsNullOrWhiteSpace(tmdbRaw)
                    && string.IsNullOrWhiteSpace(titleRaw) && string.IsNullOrWhiteSpace(yearRaw))
                    continue;

                if (++total > MaxRows)
                    throw new ValidationException("File", $"En fazla {MaxRows} satır içe aktarılabilir.");

                var imdb = imdbRaw?.ToLowerInvariant();
                if (imdb is null || !ImdbPattern.IsMatch(imdb)) imdb = null;

                int? tmdb = int.TryParse(tmdbRaw, NumberStyles.None, CultureInfo.InvariantCulture, out var t) && t > 0
                    ? t : null;

                var title = string.IsNullOrWhiteSpace(titleRaw) || titleRaw.Length > MaxTitleLength
                    ? null : titleRaw;

                int? year = int.TryParse(yearRaw, NumberStyles.None, CultureInfo.InvariantCulture, out var y)
                            && y is >= 1888 and <= 2100
                    ? y : null;

                if (imdb is null && tmdb is null && title is null)
                {
                    invalid++;
                    continue;
                }

                // Parser.Row: başlık 1. satır, ilk veri satırı 2 (Excel satır numarasıyla aynı).
                rows.Add(new WatchlistCsvRow(csv.Parser.Row, imdb, tmdb, title, year));
            }
        }
        catch (CsvHelperException)
        {
            throw new ValidationException("File", "Dosya okunamadı: CSV biçimi hatalı.");
        }

        return new ParsedWatchlist(rows, invalid);
    }

    /// <summary>Önce katı UTF-8; olmazsa Türkçe Excel'in varsayılanı Windows-1254.</summary>
    private static string Decode(byte[] bytes)
    {
        try
        {
            return new UTF8Encoding(false, throwOnInvalidBytes: true).GetString(bytes);
        }
        catch (DecoderFallbackException)
        {
            return Encoding.GetEncoding(1254).GetString(bytes);
        }
    }

    private static string DetectDelimiter(string text)
    {
        var end = text.IndexOf('\n');
        var line = end < 0 ? text : text[..end];

        int comma = 0, semi = 0, tab = 0;
        var inQuotes = false;
        foreach (var c in line)
        {
            if (c == '"') inQuotes = !inQuotes;
            else if (!inQuotes)
            {
                if (c == ',') comma++;
                else if (c == ';') semi++;
                else if (c == '\t') tab++;
            }
        }

        if (tab > comma && tab > semi) return "\t";
        return semi > comma ? ";" : ",";
    }

    /// <summary>"TMDb ID", "tmdb_id", "Tmdb-Id" → "tmdbid".</summary>
    private static string NormalizeHeader(string h) =>
        new string(h.Where(char.IsLetterOrDigit).ToArray()).ToLowerInvariant();
}