using System.Diagnostics;
using Microsoft.EntityFrameworkCore;
using Npgsql;
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
        var parallelism = 24;
        for (int i = 0; i < args.Length; i++)
        {
            if (args[i] is "--status" or "--once" or "--retry-failed") continue;
            if (args[i] == "--batch-size" && i + 1 < args.Length &&
                int.TryParse(args[++i], out size) && size is >= 1 and <= 500) continue;
            if (args[i] == "--parallel" && i + 1 < args.Length &&
                int.TryParse(args[++i], out parallelism) && parallelism is >= 1 and <= 64) continue;
            throw new ArgumentException("Seçenekler: --status | [--once] [--retry-failed] [--batch-size 1..500] [--parallel 1..64]");
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

            var wall = Stopwatch.StartNew();
            var writes = new Stopwatch();
            var buffer = new List<Download>(25);
            async Task FlushAsync()
            {
                if (buffer.Count == 0) return;
                writes.Start();
                failed += await SaveGroupAsync(options, buffer, ct);
                writes.Stop();
                buffer.Clear();
            }

            await foreach (var result in PrefetchAsync(movies, fetch, parallelism, ct))
            {
                cursor = result.Movie.TmdbId;
                if (result.Error is not null || result.Detail?.Id != cursor)
                {
                    await FlushAsync();
                    var reason = result.Error is HttpRequestException http && http.StatusCode.HasValue
                        ? $"HTTP {(int)http.StatusCode.Value}" : result.Error?.GetType().Name ?? "Missing movie";
                    await RecordAsync(catalog, result.Movie.MovieId, cursor, false, reason, ct);
                    Console.Error.WriteLine($"TMDB {cursor}: {reason}");
                    failed++;
                    if (++consecutiveFailures >= 3)
                    {
                        await PrintStatusAsync(catalog, ct);
                        return 1;
                    }
                    continue;
                }
                consecutiveFailures = 0;
                buffer.Add(result);
                if (buffer.Count == 25) await FlushAsync();
            }
            await FlushAsync();
            Console.WriteLine($"{movies.Count} film: toplam {wall.Elapsed.TotalSeconds:F1} sn, " +
                $"veritabanı grupları {writes.Elapsed.TotalSeconds:F1} sn, " +
                $"indirme bekleme ve diğer {(wall.Elapsed - writes.Elapsed).TotalSeconds:F1} sn.");
        } while (!once);
        await PrintStatusAsync(catalog, ct);
        return failed == 0 ? 0 : 1;
    }

    private static async Task<int> SaveGroupAsync(DbContextOptions<ApplicationDbContext> options,
        List<Download> group, CancellationToken ct)
    {
        try
        {
            await using var db = new ApplicationDbContext(options);
            await using var tx = await db.Database.BeginTransactionAsync(ct);
            await MovieCreditImport.LockAsync(db, ct);
            var ids = group.Select(x => x.Movie.MovieId).ToArray();
            var eligible = await db.Database.SqlQuery<Candidate>($"""
                SELECT m."Id" AS "MovieId", m."TmdbId" FROM "Movies" m
                WHERE m."Id" = ANY({ids}) AND NOT m."IsDeleted" AND m."TmdbId" IS NOT NULL
                  AND NOT EXISTS (SELECT 1 FROM "ArchiveCreditProgress" p WHERE p."MovieId" = m."Id"
                    AND p."TmdbId" = m."TmdbId" AND p."Completed")
                """).ToListAsync(ct);
            var keys = eligible.Select(x => (x.MovieId, x.TmdbId)).ToHashSet();
            var films = group.Where(x => keys.Contains((x.Movie.MovieId, x.Movie.TmdbId)))
                .ToDictionary(x => x.Movie.MovieId, x => x.Detail!.Credits);
            if (films.Count == 0) return 0;
            var counts = await MovieCreditImport.MergeBatchAsync(db, films, ct);
            var saved = counts.Keys.ToArray();
            await db.Database.ExecuteSqlInterpolatedAsync($"""
                INSERT INTO "ArchiveCreditProgress" ("MovieId","TmdbId","Completed","Attempts","LastError")
                SELECT m."Id", m."TmdbId", TRUE, 1, NULL FROM "Movies" m WHERE m."Id" = ANY({saved})
                ON CONFLICT ("MovieId","TmdbId") DO UPDATE SET "Completed" = TRUE,
                  "Attempts" = "ArchiveCreditProgress"."Attempts" + 1, "LastError" = NULL, "UpdatedAt" = now()
                """, ct);
            await tx.CommitAsync(ct);
            Console.WriteLine($"{counts.Count} film kaydedildi, {counts.Values.Sum()} yeni kredi.");
            return 0;
        }
        catch (Exception ex) when (!ct.IsCancellationRequested && IsDataError(ex))
        {
            // The failed transaction has been disposed before either half is retried.
            if (group.Count > 1)
            {
                int mid = group.Count / 2;
                var left = await SaveGroupAsync(options, group.GetRange(0, mid), ct);
                return left + await SaveGroupAsync(options, group.GetRange(mid, group.Count - mid), ct);
            }
            var film = group[0].Movie;
            await using var db = new ApplicationDbContext(options);
            await RecordAsync(db, film.MovieId, film.TmdbId, false, ex.GetType().Name, ct);
            Console.Error.WriteLine($"TMDB {film.TmdbId}: {ex.GetType().Name}");
            return 1;
        }
    }

    private static bool IsDataError(Exception ex) => ex is InvalidDataException ||
        ex.GetBaseException() is PostgresException pg && (pg.SqlState.StartsWith("22") || pg.SqlState.StartsWith("23"));

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
