using Microsoft.EntityFrameworkCore;
using UFMDb.Domain.Entities;
using UFMDb.Persistence;
using UFMDb.Tools.TmdbImporter.Models;

namespace UFMDb.Tools.TmdbImporter;

public static class MovieCreditImport
{
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

    private static List<Entry> SelectEntries(TmdbCredits? credits, HashSet<int> castIds)
    {
        if (credits?.Cast is null || credits.Crew is null)
            throw new InvalidDataException("TMDB cast/crew alanları eksik.");

        if (credits.Cast.Count == 0 && credits.Crew.Count == 0)
            throw new InvalidDataException("TMDB kredi listesi boş.");

        var entries = credits.Cast.Where(x => castIds.Contains(x.Id)).OrderBy(x => x.Order).Select(x => new Entry(x.CreditId, x.Id, x.Name, x.ProfilePath,
                CreditKind.Cast, "Acting", "Actor", x.Character, x.Order))
            .Concat(credits.Crew.Select((x, index) => new Entry(x.CreditId, x.Id, x.Name, x.ProfilePath,
                CreditKind.Crew, x.Department ?? "", x.Job ?? "", null, index)).Where(x => SelectedCrewJobs.Contains(x.Job))).ToList();

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
        var castRows = await db.Set<MovieActor>()
            .Where(link => movieIds.Contains(link.MovieId) && link.Actor.TmdbId.HasValue)
            .Select(link => new { link.MovieId, Person = link.Actor.TmdbId!.Value }).ToListAsync(ct);
        var cast = castRows.ToLookup(x => x.MovieId, x => x.Person);
        var selected = films.ToDictionary(f => f.Key, f => SelectEntries(f.Value, cast[f.Key].ToHashSet()));
        var ids = selected.Values.SelectMany(entries => entries).Select(x => x.PersonId).Distinct().ToList();
        var people = await db.People.IgnoreQueryFilters().Where(x => x.TmdbId.HasValue && ids.Contains(x.TmdbId.Value))
            .ToDictionaryAsync(x => x.TmdbId!.Value, ct);
        var actors = await db.Actors.IgnoreQueryFilters().Where(x => x.TmdbId.HasValue && ids.Contains(x.TmdbId.Value))
            .ToDictionaryAsync(x => x.TmdbId!.Value, x => x.Id, ct);
        var directors = await db.Directors.IgnoreQueryFilters().Where(x => x.TmdbId.HasValue && ids.Contains(x.TmdbId.Value))
            .ToDictionaryAsync(x => x.TmdbId!.Value, x => x.Id, ct);
        var allRows = await db.MovieCredits.Where(c => movieIds.Contains(c.MovieId)).ToListAsync(ct);
        var rowsByMovie = allRows.ToLookup(c => c.MovieId);
        var counts = new Dictionary<Guid, int>();
        foreach (var (movieId, entries) in selected)
        {
            var rows = rowsByMovie[movieId];
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
                if (actors.TryGetValue(entry.PersonId, out var actor)) person.LegacyActorId ??= actor;
                if (directors.TryGetValue(entry.PersonId, out var director)) person.LegacyDirectorId ??= director;
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
            counts.Add(movieId, inserted);
        }
        await db.SaveChangesAsync(ct);
        return counts;
    }
}
