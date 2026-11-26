using Microsoft.EntityFrameworkCore;
using UFMDb.Domain.Entities;
using UFMDb.Persistence;
using UFMDb.Tools.TmdbImporter.Models;

namespace UFMDb.Tools.TmdbImporter;

public static class MovieCreditImport
{
    // Film başına alınacak maksimum oyuncu sayısı (TMDB cast sırasına göre ilk N).
    // Eski MovieActors filtresinin yerine geçer; tablo boyutunu buradan kontrol edebilirsin.
    private const int MaxCastPerMovie = 12;

    private static readonly HashSet<string> SelectedCrewJobs = new(StringComparer.Ordinal)
    {
        "Director", "Writer", "Screenplay", "Story", "Novel", "Director of Photography",
        "Editor", "Original Music Composer", "Production Design", "Costume Design", "Producer"
    };

    private sealed record Entry(string CreditId, int PersonId, string Name, string? Photo,
        CreditKind Kind, string Department, string Job, string? Character, int Order);

    // One transaction per film. Different films may share previously unseen people.
    internal static Task LockAsync(ApplicationDbContext db, CancellationToken ct) =>
        db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(18732024, 2)", ct);

    public static async Task<int> MergeAsync(ApplicationDbContext db, Guid movieId, TmdbCredits? credits, CancellationToken ct)
    {
        var counts = await MergeBatchAsync(db, new Dictionary<Guid, TmdbCredits?> { [movieId] = credits }, ct);
        return counts[movieId];
    }

    private static List<Entry> SelectEntries(TmdbCredits? credits)
    {
        if (credits?.Cast is null || credits.Crew is null)
            throw new InvalidDataException("TMDB cast/crew alanları eksik.");

        if (credits.Cast.Count == 0 && credits.Crew.Count == 0)
            throw new InvalidDataException("TMDB kredi listesi boş.");

        var entries = credits.Cast.OrderBy(x => x.Order).Take(MaxCastPerMovie)
            .Select(x => new Entry(x.CreditId, x.Id, x.Name, x.ProfilePath,
                CreditKind.Cast, "Acting", "Actor", x.Character, x.Order))
            .Concat(credits.Crew.Select((x, index) => new Entry(x.CreditId, x.Id, x.Name, x.ProfilePath,
                CreditKind.Crew, x.Department ?? "", x.Job ?? "", null, index)).Where(x => SelectedCrewJobs.Contains(x.Job)))
            .ToList();

        if (entries.Any(x => x.PersonId <= 0 || string.IsNullOrWhiteSpace(x.CreditId)
            || string.IsNullOrWhiteSpace(x.Name) || string.IsNullOrWhiteSpace(x.Job)))
            throw new InvalidDataException("TMDB kredi listesi boş veya geçersiz.");

        if (entries.GroupBy(x => x.CreditId).Any(g => g.Select(x => (x.PersonId, x.Kind, x.Job, x.Character)).Distinct().Count() > 1))
            throw new InvalidDataException("TMDB yanıtında aynı kredi kimliği farklı görevlere ait.");

        return entries;
    }

    internal static async Task<Dictionary<Guid, int>> MergeBatchAsync(ApplicationDbContext db,
        Dictionary<Guid, TmdbCredits?> films, CancellationToken ct)
    {
        var movieIds = films.Keys.ToArray();
        var selected = films.ToDictionary(f => f.Key, f => SelectEntries(f.Value));
        var ids = selected.Values.SelectMany(entries => entries).Select(x => x.PersonId).Distinct().ToList();

        var people = await db.People.IgnoreQueryFilters().Where(x => x.TmdbId.HasValue && ids.Contains(x.TmdbId.Value))
            .ToDictionaryAsync(x => x.TmdbId!.Value, ct);
        var allRows = await db.MovieCredits.Where(c => movieIds.Contains(c.MovieId)).ToListAsync(ct);
        var rowsByMovie = allRows.ToLookup(c => c.MovieId);
        var counts = new Dictionary<Guid, int>();

        // Çok sayıda Add/değişiklik olduğunda her çağrıda DetectChanges çalışmasın diye kapatıyoruz;
        // SaveChanges öncesi bir kez elle çalıştırıyoruz.
        var previousAutoDetect = db.ChangeTracker.AutoDetectChangesEnabled;
        db.ChangeTracker.AutoDetectChangesEnabled = false;
        try
        {
            foreach (var (movieId, entries) in selected)
            {
                var rows = rowsByMovie[movieId].ToList();
                var bySource = rows.Where(c => c.TmdbCreditId != null).ToDictionary(c => c.TmdbCreditId!);
                var legacy = rows.Where(c => c.TmdbCreditId == null).ToList();
                int inserted = 0;

                foreach (var entry in entries)
                {
                    if (!people.TryGetValue(entry.PersonId, out var person))
                    {
                        person = new Person { TmdbId = entry.PersonId, FullName = entry.Name };
                        db.People.Add(person);
                        people.Add(entry.PersonId, person);
                    }
                    if (string.IsNullOrEmpty(person.PhotoUrl))
                        person.PhotoUrl = TmdbClient.BuildImageUrl(entry.Photo, "w300") ?? "";

                    if (!bySource.TryGetValue(entry.CreditId, out var row))
                    {
                        row = legacy.FirstOrDefault(c => c.PersonId == person.Id && c.Kind == entry.Kind && c.Job == entry.Job);
                        if (row is null)
                        {
                            row = new MovieCredit { MovieId = movieId, PersonId = person.Id, Kind = entry.Kind };
                            db.MovieCredits.Add(row);
                            inserted++;
                        }
                        else legacy.Remove(row);
                        row.TmdbCreditId = entry.CreditId;
                        bySource.Add(entry.CreditId, row);
                    }
                    if (row.PersonId != person.Id || row.Kind != entry.Kind)
                        throw new InvalidDataException($"Çelişkili TMDB kredi kimliği: {entry.CreditId}");
                    row.Department = entry.Department;
                    row.Job = entry.Job;
                    row.CharacterName = entry.Character;
                    row.Order = entry.Order;
                }

                // Artık seçili listede olmayan (TMDB'den kalkmış ya da filtre dışı kalmış) kredileri temizle.
                // TmdbCreditId'si boş olan eski satırlara dokunulmaz.
                var keep = entries.Select(x => x.CreditId).ToHashSet(StringComparer.Ordinal);
                var stale = rows.Where(c => c.TmdbCreditId != null && !keep.Contains(c.TmdbCreditId)).ToList();
                if (stale.Count > 0) db.MovieCredits.RemoveRange(stale);

                counts.Add(movieId, inserted);
            }

            db.ChangeTracker.DetectChanges();
            await db.SaveChangesAsync(ct);
        }
        finally
        {
            db.ChangeTracker.AutoDetectChangesEnabled = previousAutoDetect;
        }

        return counts;
    }
}