using System.Text.RegularExpressions;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Domain.Entities;
using UFMDb.Domain.Enums;

namespace UFMDb.Application.Features.Users;

/// <param name="Reason">"NotFound" (katalogda yok) | "Ambiguous" (birden fazla film uyuyor, tahmin edilmedi).</param>
public record WatchlistImportMissDto(int Row, string Title, int? Year, string Reason);

/// <summary>TotalRows = Added + AlreadyInWatchlist + DuplicateRows + NotFound.Count + InvalidRows.</summary>
public record WatchlistImportResultDto(
    int TotalRows, int Added, int AlreadyInWatchlist, int DuplicateRows,
    List<WatchlistImportMissDto> NotFound, int InvalidRows);

public record ImportWatchlistCommand(Guid UserId, byte[] Content) : IRequest<WatchlistImportResultDto>;

public class ImportWatchlistCommandValidator : AbstractValidator<ImportWatchlistCommand>
{
    public const int MaxBytes = 1024 * 1024;

    public ImportWatchlistCommandValidator()
    {
        RuleFor(x => x.Content)
            .NotNull().WithMessage("Dosya seçilmedi.")
            .Must(c => c.Length > 0).WithMessage("Dosya boş.")
            .Must(c => c.Length <= MaxBytes).WithMessage("Dosya 1 MB'ı geçemez.");
    }
}

public class ImportWatchlistCommandHandler : IRequestHandler<ImportWatchlistCommand, WatchlistImportResultDto>
{
    private static readonly Regex Spaces = new(@"\s+", RegexOptions.Compiled);

    private readonly IApplicationDbContext _context;
    public ImportWatchlistCommandHandler(IApplicationDbContext context) => _context = context;

    private static string NormTitle(string s) => Spaces.Replace(s.Trim(), " ").ToLowerInvariant();

    private static WatchlistImportMissDto Miss(WatchlistCsvRow r, string reason) =>
        new(r.RowNumber, r.Title ?? r.ImdbId ?? $"TMDB {r.TmdbId}", r.Year, reason);

    public async Task<WatchlistImportResultDto> Handle(ImportWatchlistCommand request, CancellationToken ct)
    {
        var parsed = WatchlistCsvParser.Parse(request.Content);

        var resolved = new Dictionary<int, Guid>(); // satır no -> film id
        var misses = new List<WatchlistImportMissDto>();
        var pending = parsed.Rows;

        // 1) IMDb kimliği: en güvenilir eşleşme. Toplu sorgu.
        var imdbIds = pending.Where(r => r.ImdbId is not null).Select(r => r.ImdbId!).Distinct().ToList();
        if (imdbIds.Count > 0)
        {
            var found = await _context.Movies.AsNoTracking()
                .Where(m => m.ImdbId != null && imdbIds.Contains(m.ImdbId!))
                .Select(m => new { m.Id, m.ImdbId })
                .ToListAsync(ct);
            var byImdb = found.GroupBy(x => x.ImdbId!).ToDictionary(g => g.Key, g => g.First().Id);

            foreach (var r in pending)
                if (r.ImdbId is not null && byImdb.TryGetValue(r.ImdbId, out var id))
                    resolved[r.RowNumber] = id;
            pending = pending.Where(r => !resolved.ContainsKey(r.RowNumber)).ToList();
        }

        // 2) TMDB kimliği.
        var tmdbIds = pending.Where(r => r.TmdbId.HasValue).Select(r => r.TmdbId!.Value).Distinct().ToList();
        if (tmdbIds.Count > 0)
        {
            var found = await _context.Movies.AsNoTracking()
                .Where(m => m.TmdbId.HasValue && tmdbIds.Contains(m.TmdbId.Value))
                .Select(m => new { m.Id, TmdbId = m.TmdbId!.Value })
                .ToListAsync(ct);
            var byTmdb = found.GroupBy(x => x.TmdbId).ToDictionary(g => g.Key, g => g.First().Id);

            foreach (var r in pending)
                if (r.TmdbId.HasValue && byTmdb.TryGetValue(r.TmdbId.Value, out var id))
                    resolved[r.RowNumber] = id;
            pending = pending.Where(r => !resolved.ContainsKey(r.RowNumber)).ToList();
        }

        // 3) Başlık (+ yıl): İngilizce, orijinal ve Türkçe başlıkların hepsinde tam eşleşme.
        //    Yıl varsa aynı olmalı; birden fazla film uyuyorsa tahmin etmeyiz.
        var titles = pending.Where(r => r.Title is not null).Select(r => NormTitle(r.Title!)).Distinct().ToList();
        var index = new Dictionary<string, List<(Guid Id, int Year)>>();
        if (titles.Count > 0)
        {
            var candidates = await _context.Movies.AsNoTracking()
                .Where(m => titles.Contains(m.Title.ToLower())
                            || titles.Contains(m.OriginalTitle.ToLower())
                            || titles.Contains(m.TitleTr.ToLower()))
                .Select(m => new { m.Id, m.Title, m.OriginalTitle, m.TitleTr, m.ReleaseYear })
                .ToListAsync(ct);

            foreach (var c in candidates)
            {
                var keys = new[] { c.Title, c.OriginalTitle, c.TitleTr }
                    .Where(s => !string.IsNullOrWhiteSpace(s)).Select(NormTitle).Distinct();
                foreach (var key in keys)
                {
                    if (!index.TryGetValue(key, out var list))
                    {
                        list = new List<(Guid Id, int Year)>();
                        index[key] = list;
                    }
                    list.Add((c.Id, c.ReleaseYear));
                }
            }
        }

        foreach (var r in pending)
        {
            if (r.Title is null || !index.TryGetValue(NormTitle(r.Title), out var list))
            {
                misses.Add(Miss(r, "NotFound"));
                continue;
            }

            var matches = list
                .Where(c => !r.Year.HasValue || c.Year == r.Year.Value)
                .Select(c => c.Id).Distinct().ToList();

            if (matches.Count == 1) resolved[r.RowNumber] = matches[0];
            else misses.Add(Miss(r, matches.Count == 0 ? "NotFound" : "Ambiguous"));
        }

        // Dosyada aynı filme giden satırlar tek sayılır (ilk görülen kalır).
        var seen = new HashSet<Guid>();
        var movieIds = new List<Guid>();
        var duplicates = 0;
        foreach (var r in parsed.Rows.OrderBy(r => r.RowNumber))
        {
            if (!resolved.TryGetValue(r.RowNumber, out var movieId)) continue;
            if (seen.Add(movieId)) movieIds.Add(movieId);
            else duplicates++;
        }

        // Zaten listede olanlar atlanır. İzlenmiş filmler ATLANMAZ (tekrar izleme için eklenebilir).
        var existing = await LoadExistingAsync(request.UserId, movieIds, ct);
        var entities = NewItems(request.UserId, movieIds, existing);

        if (entities.Count > 0)
        {
            _context.WatchlistItems.AddRange(entities);
            try
            {
                await _context.SaveChangesAsync(ct);
            }
            catch (DbUpdateException)
            {
                // Eşzamanlı bir istek aynı filmleri eklemiş olabilir (unique index): eklenenleri
                // takipten çıkar, güncel duruma göre bir kez daha dene.
                _context.WatchlistItems.RemoveRange(entities);
                existing = await LoadExistingAsync(request.UserId, movieIds, ct);
                entities = NewItems(request.UserId, movieIds, existing);
                if (entities.Count > 0)
                {
                    _context.WatchlistItems.AddRange(entities);
                    await _context.SaveChangesAsync(ct);
                }
            }
        }

        var added = entities.Count;
        return new WatchlistImportResultDto(
            parsed.Rows.Count + parsed.InvalidRows,
            added,
            movieIds.Count - added,
            duplicates,
            misses.OrderBy(m => m.Row).ToList(),
            parsed.InvalidRows);
    }

    private async Task<HashSet<Guid>> LoadExistingAsync(Guid userId, List<Guid> movieIds, CancellationToken ct)
    {
        if (movieIds.Count == 0) return new HashSet<Guid>();
        var ids = await _context.WatchlistItems.AsNoTracking()
            .Where(w => w.UserId == userId && movieIds.Contains(w.MovieId))
            .Select(w => w.MovieId)
            .ToListAsync(ct);
        return ids.ToHashSet();
    }

    private static List<WatchlistItem> NewItems(Guid userId, List<Guid> movieIds, HashSet<Guid> existing) =>
        movieIds.Where(id => !existing.Contains(id))
            .Select(id => new WatchlistItem { MovieId = id, UserId = userId, Status = WatchStatus.PlanToWatch })
            .ToList();
}