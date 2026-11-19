using Microsoft.EntityFrameworkCore;
using UFMDb.Persistence;
using UFMDb.Tools.TmdbImporter.Models;

namespace UFMDb.Tools.TmdbImporter;

public static class ArchiveCreditBackfill
{
    // The ledger belongs to this one-time archive import. The pilot and daily import
    // can continue to refresh completed films independently.
    private const string Setup = """
        CREATE TABLE IF NOT EXISTS "ArchiveCreditProgress" (
            "MovieId" uuid NOT NULL REFERENCES "Movies" ("Id") ON DELETE CASCADE,
            "TmdbId" integer NOT NULL,
            "Completed" boolean NOT NULL,
            "Attempts" integer NOT NULL,
            "LastError" text,
            "UpdatedAt" timestamptz NOT NULL DEFAULT now(),
            PRIMARY KEY ("MovieId", "TmdbId")
        )
        """;

    public static async Task<int> RunAsync(DbContextOptions<ApplicationDbContext> options,
        Func<int, CancellationToken, Task<TmdbMovieDetail?>> fetch, string[] args, CancellationToken ct)
    {
        var retry = args.Contains("--retry-failed");
        var status = args.Contains("--status");
        var once = args.Contains("--once");
        var size = 25;
        var parallelism = 1;
        for (int i = 0; i < args.Length; i++)
        {
            if (args[i] is "--status" or "--once" or "--retry-failed") continue;
            if (args[i] == "--batch-size" && i + 1 < args.Length &&
                int.TryParse(args[++i], out size) && size is >= 1 and <= 500) continue;
            if (args[i] == "--parallel" && i + 1 < args.Length &&
                int.TryParse(args[++i], out parallelism) && parallelism is >= 1 and <= 8) continue;
            throw new ArgumentException("Seçenekler: --status | [--once] [--retry-failed] [--batch-size 1..500] [--parallel 1..8]");
        }

        await using var catalog = new ApplicationDbContext(options);
        await using (var setup = await catalog.Database.BeginTransactionAsync(ct))
        {
            await MovieCreditImport.LockAsync(catalog, ct);
            await catalog.Database.ExecuteSqlRawAsync(Setup, ct);
            await setup.CommitAsync(ct);
        }
        if (status) { await PrintStatusAsync(catalog, ct); return 0; }

        int cursor = 0, failed = 0, consecutiveFailures = 0;
        do
        {
            var movies = await catalog.Database.SqlQuery<Candidate>($"""
                SELECT m."Id" AS "MovieId", m."TmdbId" FROM "Movies" m
                LEFT JOIN "ArchiveCreditProgress" p ON p."MovieId" = m."Id" AND p."TmdbId" = m."TmdbId"
                WHERE NOT m."IsDeleted" AND m."TmdbId" > {cursor}
                  AND (({retry} AND p."Completed" = FALSE) OR (NOT {retry} AND p."MovieId" IS NULL))
                ORDER BY m."TmdbId" LIMIT {size}
                """).ToListAsync(ct);
            if (movies.Count == 0) break;

            await foreach (var result in PrefetchAsync(movies, fetch, parallelism, ct))
            {
                ct.ThrowIfCancellationRequested();
                var id = result.Movie.TmdbId;
                cursor = id;
                var movieId = result.Movie.MovieId;

                try
                {
                    if (result.Error is not null) throw result.Error;
                    var detail = result.Detail;
                    if (detail?.Id != id) throw new InvalidDataException("TMDB ayrıntısı eksik veya film kimliği uyuşmuyor.");
                    await using var db = new ApplicationDbContext(options);
                    await using var tx = await db.Database.BeginTransactionAsync(ct);
                    await MovieCreditImport.LockAsync(db, ct);
                    if (!await db.Movies.AnyAsync(m => m.Id == movieId && m.TmdbId == id, ct)) continue;
                    var done = await db.Database.SqlQuery<int>($"""
                        SELECT 1 AS "Value" FROM "ArchiveCreditProgress"
                        WHERE "MovieId" = {movieId} AND "TmdbId" = {id} AND "Completed"
                        """).AnyAsync(ct);
                    if (done) continue;
                    var added = await MovieCreditImport.MergeAsync(db, movieId, detail.Credits, ct);
                    await RecordAsync(db, movieId, id, true, null, ct);
                    await tx.CommitAsync(ct);
                    Console.WriteLine($"TMDB {id}: {added} yeni kredi.");
                    consecutiveFailures = 0;
                }
                catch (Exception ex) when (!ct.IsCancellationRequested)
                {
                    // Do not persist request URLs, credentials or arbitrary response bodies.
                    var reason = ex is HttpRequestException http && http.StatusCode.HasValue
                        ? $"HTTP {(int)http.StatusCode.Value}" : ex.GetType().Name;
                    await RecordAsync(catalog, movieId, id, false, reason, ct);
                    Console.Error.WriteLine($"TMDB {id}: {reason}; yeniden denemeye kaydedildi.");
                    failed++;
                    if (++consecutiveFailures >= 3)
                    {
                        Console.Error.WriteLine("Art arda üç hata: aktarım durduruldu.");
                        await PrintStatusAsync(catalog, ct);
                        return 1;
                    }
                }
            }
        } while (!once);
        await PrintStatusAsync(catalog, ct);
        return failed == 0 ? 0 : 1;
    }

    private sealed class Candidate
    {
        public Guid MovieId { get; set; }
        public int TmdbId { get; set; }
    }

    private sealed record Download(Candidate Movie, TmdbMovieDetail? Detail, Exception? Error);

    private static async IAsyncEnumerable<Download> PrefetchAsync(
        List<Candidate> movies, Func<int, CancellationToken, Task<TmdbMovieDetail?>> fetch,
        int parallelism, [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken ct)
    {
        using var stop = CancellationTokenSource.CreateLinkedTokenSource(ct);
        var pending = new Queue<Task<Download>>();
        async Task<Download> DownloadAsync(Candidate movie)
        {
            try { return new Download(movie, await fetch(movie.TmdbId, stop.Token), null); }
            catch (Exception ex) { return new Download(movie, null, ex); }
        }

        int next = 0;
        try
        {
            while (next < movies.Count || pending.Count > 0)
            {
                ct.ThrowIfCancellationRequested();
                while (next < movies.Count && pending.Count < parallelism)
                    pending.Enqueue(DownloadAsync(movies[next++]));
                var result = await pending.Dequeue();
                ct.ThrowIfCancellationRequested();
                yield return result;
            }
        }
        finally
        {
            stop.Cancel();
            await Task.WhenAll(pending);
        }
    }

    private static Task RecordAsync(ApplicationDbContext db, Guid movie, int tmdb, bool completed,
        string? error, CancellationToken ct) => db.Database.ExecuteSqlInterpolatedAsync($"""
        INSERT INTO "ArchiveCreditProgress" ("MovieId", "TmdbId", "Completed", "Attempts", "LastError")
        VALUES ({movie}, {tmdb}, {completed}, 1, {error})
        ON CONFLICT ("MovieId", "TmdbId") DO UPDATE
        SET "Completed" = EXCLUDED."Completed", "Attempts" = "ArchiveCreditProgress"."Attempts" + 1,
            "LastError" = EXCLUDED."LastError", "UpdatedAt" = now()
        WHERE NOT "ArchiveCreditProgress"."Completed"
        """, ct);

    private static async Task PrintStatusAsync(ApplicationDbContext db, CancellationToken ct)
    {
        var rows = await db.Database.SqlQueryRaw<string>("""
            SELECT concat('Bekleyen: ', count(*) FILTER (WHERE p."MovieId" IS NULL),
                          ' | Başarılı: ', count(*) FILTER (WHERE p."Completed"),
                          ' | Hatalı: ', count(*) FILTER (WHERE NOT p."Completed")) AS "Value"
            FROM "Movies" m LEFT JOIN "ArchiveCreditProgress" p
              ON p."MovieId" = m."Id" AND p."TmdbId" = m."TmdbId"
            WHERE NOT m."IsDeleted" AND m."TmdbId" > 0
            """).ToListAsync(ct);
        Console.WriteLine(rows.Single());
    }
}
