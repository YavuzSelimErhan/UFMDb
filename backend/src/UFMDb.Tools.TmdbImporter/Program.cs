using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using UFMDb.Application.Common.Services;
using UFMDb.Domain.Entities;
using UFMDb.Domain.Enums;
using UFMDb.Persistence;
using UFMDb.Tools.TmdbImporter;
using UFMDb.Tools.TmdbImporter.Models;
using System.Diagnostics;

static DateTime? ParseUtcDate(string? value)
{
    if (string.IsNullOrWhiteSpace(value)) return null;
    return DateTime.TryParse(
        value,
        System.Globalization.CultureInfo.InvariantCulture,
        System.Globalization.DateTimeStyles.AssumeUniversal | System.Globalization.DateTimeStyles.AdjustToUniversal,
        out var d) ? d : null;
}

Console.WriteLine("=== UFMDb TMDB Import Aracı ===\n");

// ---------------- Yapılandırma ----------------
var configuration = new ConfigurationBuilder()
    .SetBasePath(AppContext.BaseDirectory)
    .AddJsonFile("appsettings.json", optional: false)
    .AddEnvironmentVariables()
    .Build();

var apiKey = configuration["Tmdb:ApiKey"];
var connectionString = configuration.GetConnectionString("DefaultConnection");
var targetMovieCount = int.Parse(configuration["Tmdb:TargetMovieCount"] ?? "200");
var minVoteCount = int.Parse(configuration["Tmdb:MinVoteCount"] ?? "1000");
var upcomingMovieCount = int.Parse(configuration["Tmdb:UpcomingMovieCount"] ?? "20");
var upcomingWindowDays = int.Parse(configuration["Tmdb:UpcomingWindowDays"] ?? "180");
var postReleaseRefreshDays = int.Parse(configuration["Tmdb:PostReleaseRefreshDays"] ?? "30");
var refreshCheckpointDays = (configuration["Tmdb:RefreshCheckpointDays"] ?? "2, 3, 5, 10, 20")
    .Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
    .Select(int.Parse)
    .Where(d => d > 0)
    .OrderBy(d => d)
    .ToArray();
var turkishMovieCount = int.Parse(configuration["Tmdb:TurkishMovieCount"] ?? "200");
var castLimit = 12; // her filmden alınacak maksimum oyuncu sayısı

// Film başına saklanacak maksimum video / görsel sayıları (DB satır sayısını düşük tutar)
const int maxVideosPerMovie = 5;
const int maxPostersPerMovie = 5;
const int maxBackdropsPerMovie = 5;
const int maxLogosPerMovie = 2;

// TMDB isteklerinin aynı anda kaç tanesinin paralel gideceği (DB yazımı yine sıralı)
const int tmdbFetchBatchSize = 8;

// Ana akıştaki (madde 2) yıl filtresi: appsettings.json'da "Tmdb:YearFrom" / "Tmdb:YearTo" olarak
// SADECE YIL yazılır (ör. "2015"). Biri veya ikisi de boş/yoksa o taraf sınırsız kalır.
// Sadece diğer modları (fetch-upcoming, fetch-turkish vb.) etkilemez, onlar kendi tarih mantığını kullanır.
var yearFromRaw = configuration["Tmdb:YearFrom"];
var yearToRaw = configuration["Tmdb:YearTo"];
int? yearFrom = string.IsNullOrWhiteSpace(yearFromRaw) ? null : int.Parse(yearFromRaw);
int? yearTo = string.IsNullOrWhiteSpace(yearToRaw) ? null : int.Parse(yearToRaw);
var releaseDateGte = yearFrom is null ? null : $"{yearFrom}-01-01";
var releaseDateLte = yearTo is null ? null : $"{yearTo}-12-31";

if (string.IsNullOrWhiteSpace(apiKey) || apiKey == "REPLACE_WITH_YOUR_TMDB_API_KEY")
{
    Console.WriteLine("HATA: appsettings.json içindeki Tmdb:ApiKey alanını gerçek TMDB API anahtarınla değiştir.");
    return;
}

// TMDB'nin standart 19 tür adı için TR çeviri sözlüğü (yeni oluşturulan türlerde kullanılır)
var genreTranslations = new Dictionary<string, string>
{
    ["Action"] = "Aksiyon",
    ["Adventure"] = "Macera",
    ["Animation"] = "Animasyon",
    ["Comedy"] = "Komedi",
    ["Crime"] = "Suç",
    ["Documentary"] = "Belgesel",
    ["Drama"] = "Dram",
    ["Family"] = "Aile",
    ["Fantasy"] = "Fantastik",
    ["History"] = "Tarih",
    ["Horror"] = "Korku",
    ["Music"] = "Müzik",
    ["Mystery"] = "Gizem",
    ["Romance"] = "Romantik",
    ["Science Fiction"] = "Bilim Kurgu",
    ["TV Movie"] = "TV Filmi",
    ["Thriller"] = "Gerilim",
    ["War"] = "Savaş",
    ["Western"] = "Vahşi Batı"
};
// Bizim önceden seed edilen genre isimleriyle TMDB isimleri arasındaki farklar (ör. "Sci-Fi" <-> "Science Fiction")
var nameAliases = new Dictionary<string, string> { ["Science Fiction"] = "Sci-Fi" };

var countryTranslations = new Dictionary<string, string>
{
    ["United States of America"] = "Amerika Birleşik Devletleri",
    ["United Kingdom"] = "Birleşik Krallık",
    ["France"] = "Fransa",
    ["Germany"] = "Almanya",
    ["Italy"] = "İtalya",
    ["Spain"] = "İspanya",
    ["Japan"] = "Japonya",
    ["South Korea"] = "Güney Kore",
    ["China"] = "Çin",
    ["Hong Kong"] = "Hong Kong",
    ["Taiwan"] = "Tayvan",
    ["India"] = "Hindistan",
    ["Canada"] = "Kanada",
    ["Australia"] = "Avustralya",
    ["Mexico"] = "Meksika",
    ["Brazil"] = "Brezilya",
    ["Argentina"] = "Arjantin",
    ["Russia"] = "Rusya",
    ["Sweden"] = "İsveç",
    ["Denmark"] = "Danimarka",
    ["Norway"] = "Norveç",
    ["Finland"] = "Finlandiya",
    ["Netherlands"] = "Hollanda",
    ["Belgium"] = "Belçika",
    ["Ireland"] = "İrlanda",
    ["Poland"] = "Polonya",
    ["Turkey"] = "Türkiye",
    ["Iran"] = "İran",
    ["Israel"] = "İsrail",
    ["Thailand"] = "Tayland",
    ["Indonesia"] = "Endonezya",
    ["Philippines"] = "Filipinler",
    ["Egypt"] = "Mısır",
    ["Nigeria"] = "Nijerya",
    ["South Africa"] = "Güney Afrika",
    ["New Zealand"] = "Yeni Zelanda",
    ["Austria"] = "Avusturya",
    ["Switzerland"] = "İsviçre",
    ["Czech Republic"] = "Çekya",
    ["Hungary"] = "Macaristan",
    ["Greece"] = "Yunanistan",
    ["Portugal"] = "Portekiz",
    ["Saudi Arabia"] = "Suudi Arabistan",
    ["United Arab Emirates"] = "Birleşik Arap Emirlikleri",
    ["Ukraine"] = "Ukrayna",
    ["Colombia"] = "Kolombiya",
    ["Chile"] = "Şili",
    ["Peru"] = "Peru",
    ["Iceland"] = "İzlanda",
    ["Romania"] = "Romanya",
    ["Bulgaria"] = "Bulgaristan",
    ["Serbia"] = "Sırbistan",
    ["Croatia"] = "Hırvatistan",
    ["Vietnam"] = "Vietnam",
    ["Malaysia"] = "Malezya",
    ["Singapore"] = "Singapur",
    ["Pakistan"] = "Pakistan",
    ["Lebanon"] = "Lübnan",
    ["Morocco"] = "Fas",
    ["Kenya"] = "Kenya",
};

var tmdb = new TmdbClient(apiKey);
var dbOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
    .UseNpgsql(connectionString)
    .Options;

// ---------------- Opsiyonel: demo/seed verisini temizleme modu ----------------
// Kullanım: dotnet run --project src/UFMDb.Tools.TmdbImporter -- cleanup-demo
if (args.Contains("cleanup-demo"))
{
    await CleanupDemoDataAsync(dbOptions);
    return;
}

if (args.Contains("reset-movies"))
{
    await ResetMoviesAsync(dbOptions);
    return;
}

// NOT: Postgres'te tırnaksız tablo/kolon adları küçük harfe çevrilir; EF PascalCase ve tırnaklı
// oluşturduğu için ham SQL'de tüm isimler çift tırnak içinde yazılmalıdır.
async Task ResetMoviesAsync(DbContextOptions<ApplicationDbContext> options)
{
    await using var db = new ApplicationDbContext(options);
    Console.WriteLine("Tüm filmler ve ilişkili veriler siliniyor...\n");

    // Restrict ilişkileri önce temizle (Movie silme işlemi FK hatası vermesin diye)
    var deletedCuratedItems = await db.Database.ExecuteSqlRawAsync("""DELETE FROM "CuratedListItems" """);
    await db.Database.ExecuteSqlRawAsync("""DELETE FROM "CuratedLists" """);
    var deletedFavorites = await db.Database.ExecuteSqlRawAsync("""DELETE FROM "FavoriteMovies" """);
    var deletedWatchHistory = await db.Database.ExecuteSqlRawAsync("""DELETE FROM "WatchHistory" """);

    // Movie silinince Review/Like/WatchlistItem/MovieGenre/MovieActor/MovieDirector/Video/Image/Keyword/... cascade ile gider
    var deletedMovies = await db.Database.ExecuteSqlRawAsync("""DELETE FROM "Movies" """);

    // Artık hiçbir filmde olmayan aktör/yönetmenleri temizle
    var deletedFavoriteActors = await db.Database.ExecuteSqlRawAsync(
        """DELETE FROM "FavoriteActors" WHERE "ActorId" IN (SELECT a."Id" FROM "Actors" a WHERE NOT EXISTS (SELECT 1 FROM "MovieActors" ma WHERE ma."ActorId" = a."Id"))""");
    var deletedActorLikes = await db.Database.ExecuteSqlRawAsync(
        """DELETE FROM "ActorLikes" WHERE "ActorId" IN (SELECT a."Id" FROM "Actors" a WHERE NOT EXISTS (SELECT 1 FROM "MovieActors" ma WHERE ma."ActorId" = a."Id"))""");
    var deletedActors = await db.Database.ExecuteSqlRawAsync(
        """DELETE FROM "Actors" WHERE NOT EXISTS (SELECT 1 FROM "MovieActors" ma WHERE ma."ActorId" = "Actors"."Id")""");

    var deletedFavoriteDirectors = await db.Database.ExecuteSqlRawAsync(
        """DELETE FROM "FavoriteDirectors" WHERE "DirectorId" IN (SELECT d."Id" FROM "Directors" d WHERE NOT EXISTS (SELECT 1 FROM "MovieDirectors" md WHERE md."DirectorId" = d."Id"))""");
    var deletedDirectorLikes = await db.Database.ExecuteSqlRawAsync(
        """DELETE FROM "DirectorLikes" WHERE "DirectorId" IN (SELECT d."Id" FROM "Directors" d WHERE NOT EXISTS (SELECT 1 FROM "MovieDirectors" md WHERE md."DirectorId" = d."Id"))""");
    var deletedDirectors = await db.Database.ExecuteSqlRawAsync(
        """DELETE FROM "Directors" WHERE NOT EXISTS (SELECT 1 FROM "MovieDirectors" md WHERE md."DirectorId" = "Directors"."Id")""");

    Console.WriteLine($"Silinen film: {deletedMovies}");
    Console.WriteLine($"Silinen aktör: {deletedActors} (favori: {deletedFavoriteActors}, beğeni: {deletedActorLikes})");
    Console.WriteLine($"Silinen yönetmen: {deletedDirectors} (favori: {deletedFavoriteDirectors}, beğeni: {deletedDirectorLikes})");
    Console.WriteLine($"Temizlenen: {deletedCuratedItems} küratör listesi öğesi, {deletedFavorites} favori film, {deletedWatchHistory} izleme geçmişi.");
    Console.WriteLine("\nReset tamamlandı. Şimdi: dotnet run --project src/UFMDb.Tools.TmdbImporter");
}

// ---------------- Opsiyonel: küratör listelerini gerçek verilerle yeniden kurma modu ----------------
// Kullanım: dotnet run --project src/UFMDb.Tools.TmdbImporter -- rebuild-curated-lists
if (args.Contains("rebuild-curated-lists"))
{
    await RebuildCuratedListsAsync(dbOptions);
    return;
}

async Task RebuildCuratedListsAsync(DbContextOptions<ApplicationDbContext> options)
{
    await using var db = new ApplicationDbContext(options);
    Console.WriteLine("Mevcut küratör listeleri temizleniyor...");
    await db.Database.ExecuteSqlRawAsync("""DELETE FROM "CuratedListItems" """);
    await db.Database.ExecuteSqlRawAsync("""DELETE FROM "CuratedLists" """);
    Console.WriteLine("Temizlendi. Yeni listeler oluşturuluyor...\n");

    var genres = await db.Genres.ToListAsync();
    Guid? FindGenreId(string name) => genres.FirstOrDefault(g => g.Name.Equals(name, StringComparison.OrdinalIgnoreCase))?.Id;

    // (Başlık, TR Başlık, Açıklama, Tür filtresi [null = tüm türler], min. oy sayısı)
    var definitions = new List<(string Title, string TitleTr, string Description, string? GenreFilter, int MinVotes)>
    {
        ("Top Rated of All Time", "Tüm Zamanların En İyileri", "Puanıyla zirveye yerleşmiş, kaçırılmaması gereken filmler.", null, 1000),
        ("Mind-Bending Sci-Fi", "Zihin Bükücü Bilim Kurgu", "Gerçeklik algını sorgulatacak bilim kurgu yapımları.", "Sci-Fi", 500),
        ("Award-Worthy Dramas", "Ödüllük Dramalar", "Derin hikayeleriyle akılda kalan dram filmleri.", "Drama", 500),
        ("Edge-of-Your-Seat Thrillers", "Nefes Kesen Gerilimler", "Sizi koltuğa kilitleyecek gerilim dolu filmler.", "Thriller", 500),
        ("Crime Classics", "Suç Klasikleri", "Yeraltı dünyasının en ikonik hikayeleri.", "Crime", 500),
        ("Feel-Good Comedies", "Keyifli Komediler", "Kötü bir günü düzeltecek komediler.", "Comedy", 500),
        ("Horror Icons", "Korku İkonları", "Işıkları açık izlenmesi tavsiye edilen korku filmleri.", "Horror", 300),
        ("Animated Masterpieces", "Animasyon Başyapıtları", "Her yaştan izleyiciyi büyüleyen animasyon filmleri.", "Animation", 300),
        ("Epic Adventures", "Epik Maceralar", "Sınırları zorlayan büyük ölçekli macera filmleri.", "Adventure", 500),
        ("Romance Through the Ages", "Zamansız Romantikler", "Kalp kırıklığından mutlu sona uzanan romantik filmler.", "Romance", 300)
    };

    var order = 1;
    foreach (var def in definitions)
    {
        var query = db.Movies.Where(m => !m.IsDeleted && m.RatingCount >= def.MinVotes);

        if (def.GenreFilter is not null)
        {
            var genreId = FindGenreId(def.GenreFilter);
            if (genreId is null)
            {
                Console.WriteLine($"UYARI: '{def.GenreFilter}' türü veritabanında bulunamadı, '{def.Title}' atlanıyor.");
                continue;
            }
            query = query.Where(m => m.MovieGenres.Any(mg => mg.GenreId == genreId));
        }

        var topMovies = await query.OrderByDescending(m => m.AverageRating).Take(10).ToListAsync();
        if (topMovies.Count == 0)
        {
            Console.WriteLine($"UYARI: '{def.Title}' için uygun film bulunamadı, atlanıyor.");
            continue;
        }

        db.CuratedLists.Add(new CuratedList
        {
            Title = def.Title,
            TitleTr = def.TitleTr,
            Description = def.Description,
            DisplayOrder = order++,
            Items = topMovies.Select((m, idx) => new CuratedListItem { MovieId = m.Id, Order = idx }).ToList()
        });

        Console.WriteLine($"'{def.TitleTr}' oluşturuldu — {topMovies.Count} film.");
    }

    await db.SaveChangesAsync();
    Console.WriteLine($"\n{order - 1} küratör listesi başarıyla oluşturuldu.");
}

async Task CleanupDemoDataAsync(DbContextOptions<ApplicationDbContext> options)
{
    await using var db = new ApplicationDbContext(options);
    Console.WriteLine("Demo/seed verisi temizleniyor (TmdbId'si NULL olan kayıtlar)...\n");

    // 1. Restrict davranışlı ilişkileri önce temizle (yoksa film silme işlemi FK hatası verir)
    var deletedCuratedItems = await db.Database.ExecuteSqlRawAsync(
        """DELETE FROM "CuratedListItems" WHERE "MovieId" IN (SELECT "Id" FROM "Movies" WHERE "TmdbId" IS NULL)""");
    var deletedFavorites = await db.Database.ExecuteSqlRawAsync(
        """DELETE FROM "FavoriteMovies" WHERE "MovieId" IN (SELECT "Id" FROM "Movies" WHERE "TmdbId" IS NULL)""");
    var deletedWatchHistory = await db.Database.ExecuteSqlRawAsync(
        """DELETE FROM "WatchHistory" WHERE "MovieId" IN (SELECT "Id" FROM "Movies" WHERE "TmdbId" IS NULL)""");

    // 2. Demo filmleri sil (Review/Like/WatchlistItem/MovieGenre/MovieActor cascade ile otomatik silinir)
    var deletedMovies = await db.Database.ExecuteSqlRawAsync("""DELETE FROM "Movies" WHERE "TmdbId" IS NULL""");

    // 3. Artık hiçbir filmde oynamayan yetim demo aktörlerini temizle
    //    (demo veride gerçek oyuncu isimleri kullanıldığı için TMDB import'u onları TmdbId'li
    //     olarak AYRICA oluşturmuş olabilir — bu adım o "sahte/eşleşmemiş" kopyaları temizler)
    var deletedFavoriteActors = await db.Database.ExecuteSqlRawAsync(
        """DELETE FROM "FavoriteActors" WHERE "ActorId" IN (SELECT a."Id" FROM "Actors" a WHERE a."TmdbId" IS NULL AND NOT EXISTS (SELECT 1 FROM "MovieActors" ma WHERE ma."ActorId" = a."Id"))""");
    var deletedActorLikes = await db.Database.ExecuteSqlRawAsync(
        """DELETE FROM "ActorLikes" WHERE "ActorId" IN (SELECT a."Id" FROM "Actors" a WHERE a."TmdbId" IS NULL AND NOT EXISTS (SELECT 1 FROM "MovieActors" ma WHERE ma."ActorId" = a."Id"))""");
    var deletedActors = await db.Database.ExecuteSqlRawAsync(
        """DELETE FROM "Actors" WHERE "TmdbId" IS NULL AND NOT EXISTS (SELECT 1 FROM "MovieActors" ma WHERE ma."ActorId" = "Actors"."Id")""");
    var deletedFavoriteDirectors = await db.Database.ExecuteSqlRawAsync(
        """DELETE FROM "FavoriteDirectors" WHERE "DirectorId" IN (SELECT d."Id" FROM "Directors" d WHERE d."TmdbId" IS NULL AND NOT EXISTS (SELECT 1 FROM "MovieDirectors" md WHERE md."DirectorId" = d."Id"))""");
    var deletedDirectorLikes = await db.Database.ExecuteSqlRawAsync(
        """DELETE FROM "DirectorLikes" WHERE "DirectorId" IN (SELECT d."Id" FROM "Directors" d WHERE d."TmdbId" IS NULL AND NOT EXISTS (SELECT 1 FROM "MovieDirectors" md WHERE md."DirectorId" = d."Id"))""");
    var deletedDirectors = await db.Database.ExecuteSqlRawAsync(
        """DELETE FROM "Directors" WHERE "TmdbId" IS NULL AND NOT EXISTS (SELECT 1 FROM "MovieDirectors" md WHERE md."DirectorId" = "Directors"."Id")""");

    Console.WriteLine($"Silinen film: {deletedMovies}");
    Console.WriteLine($"Silinen (yetim) aktör: {deletedActors}");
    Console.WriteLine($"Silinen (yetim) yönetmen: {deletedDirectors}");
    Console.WriteLine($"Temizlenen ilişkili kayıtlar: {deletedCuratedItems} küratör listesi öğesi, {deletedFavorites} favori film, {deletedWatchHistory} izleme geçmişi, {deletedFavoriteActors} favori aktör, {deletedActorLikes} aktör beğenisi, {deletedFavoriteDirectors} favori yönetmen, {deletedDirectorLikes} yönetmen beğenisi.");
    Console.WriteLine("\nTemizlik tamamlandı. Not: 'Editor's Picks' vb. küratör listeleri artık boş olabilir,");
    Console.WriteLine("admin panelinden veya doğrudan veritabanından gerçek filmlerle yeniden doldurulabilir.");
}

using var cts = new CancellationTokenSource();
Console.CancelKeyPress += (_, e) => { e.Cancel = true; cts.Cancel(); Console.WriteLine("\nDurduruluyor... (mevcut kayıt tamamlanınca çıkılacak)"); };

if (args.Contains("enrich-people"))
{
    await EnrichPeopleAsync(dbOptions);
    return;
}

async Task EnrichPeopleAsync(DbContextOptions<ApplicationDbContext> options)
{
    Console.WriteLine("Oyuncu ve yönetmenlerin biyografi/doğum tarihi/uyruk bilgileri TMDB'den çekiliyor...\n");
    List<(Guid Id, int TmdbId)> actorList;
    List<(Guid Id, int TmdbId)> directorList;

    await using (var db = new ApplicationDbContext(options))
    {
        actorList = await db.Actors.Where(a => a.TmdbId != null)
            .Select(a => new ValueTuple<Guid, int>(a.Id, a.TmdbId!.Value)).ToListAsync();
        directorList = await db.Directors.Where(d => d.TmdbId != null)
            .Select(d => new ValueTuple<Guid, int>(d.Id, d.TmdbId!.Value)).ToListAsync();
    }

    Console.WriteLine($"{actorList.Count} oyuncu, {directorList.Count} yönetmen bulundu.\n");

    Console.WriteLine("--- Oyuncular ---");
    await EnrichBatchAsync(options, actorList, isActor: true);

    Console.WriteLine("\n--- Yönetmenler ---");
    await EnrichBatchAsync(options, directorList, isActor: false);

    Console.WriteLine("\n=== Kişi zenginleştirme tamamlandı ===");
}

if (args.Contains("backfill-vote-counts"))
{
    await BackfillVoteCountsAsync(dbOptions);
    return;
}

async Task BackfillVoteCountsAsync(DbContextOptions<ApplicationDbContext> options)
{
    Console.WriteLine("Filmlerin orijinal TMDB oy sayısı (SeedVoteCount) ve puanı (SeedRating) geri dolduruluyor...\n");

    List<(Guid Id, int TmdbId)> movies;

    await using (var db = new ApplicationDbContext(options))
    {
        movies = await db.Movies.Where(m => m.TmdbId != null)
            .Select(m => new ValueTuple<Guid, int>(m.Id, m.TmdbId!.Value)).ToListAsync();
    }

    Console.WriteLine($"{movies.Count} film bulundu.\n");
    int processed = 0, updated = 0, failed = 0;

    foreach (var m in movies)
    {
        if (cts.IsCancellationRequested) break;
        processed++;

        try
        {
            var detail = await tmdb.GetMovieDetailAsync(m.TmdbId, cts.Token);
            if (detail is null) { failed++; continue; }

            await using var db = new ApplicationDbContext(options);
            var movie = await db.Movies.FindAsync(new object[] { m.Id }, cts.Token);
            if (movie is null) continue;

            movie.SeedVoteCount = detail.VoteCount;
            movie.SeedRating = Math.Round(detail.VoteAverage / 2.0, 2); // TMDB 0-10 -> bizim 0-5 ölçeği

            // RatingCount/AverageRating'i elle hesaplamak yerine tek doğru kaynağa (MovieRatingRecalculator)
            // devrediyoruz — bu sayede sitede o ana kadar verilmiş gerçek MovieRatings kayıtları da
            // (yorum sayısı değil, asıl puan tablosu) SeedVoteCount'un üzerine doğru şekilde eklenir.
            await MovieRatingRecalculator.RecalculateAsync(db, movie, cts.Token);
            updated++;

            if (processed % 100 == 0 || processed == movies.Count)
                Console.WriteLine($"[{processed}/{movies.Count}] işlendi — {updated} güncellendi, {failed} başarısız.");

            await Task.Delay(120, cts.Token);
        }
        catch (Exception ex)
        {
            failed++;
            Console.WriteLine($"[HATA] Movie TmdbId {m.TmdbId}: {ex.Message}");
        }
    }

    Console.WriteLine($"\n=== Tamamlandı — {updated}/{movies.Count} film güncellendi, {failed} başarısız ===");
}

// ---------------- Ortak: TMDB detayından Movie'nin "ek" alanlarını doldur ----------------
// Hem ImportMoviesAsync (yeni/refresh) hem BackfillMovieDetailsAsync bunu kullanır; böylece
// iki akış asla birbirinden ayrışmaz. Çağıran, movie'yi şu include'larla yüklemiş olmalı:
// Videos, Images, MovieKeywords, MovieProductionCompanies, MovieCountries, Collection.
// SaveChanges'i çağıran yapar.
static string PickTrailerKey(IEnumerable<TmdbVideo> videos) =>
    videos
        .Where(v => v.Type == "Trailer" || v.Type == "Teaser")
        .OrderBy(v => v.Type == "Trailer" ? 0 : 1)
        .ThenByDescending(v => v.Official)
        .ThenBy(v => v.Iso639_1 == "tr" ? 0 : v.Iso639_1 == "en" ? 1 : 2)
        .ThenByDescending(v => v.PublishedAt)
        .Select(v => v.Key)
        .FirstOrDefault() ?? string.Empty;

static (string Certification, string Country) PickCertification(TmdbReleaseDatesResponse? releaseDates)
{
    // Önce TR, yoksa US. Aynı ülkede birden fazla kayıt varsa sinema (type 3) önceliklidir.
    foreach (var country in new[] { "TR", "US" })
    {
        var cert = releaseDates?.Results
            .FirstOrDefault(r => r.Iso3166_1 == country)?.ReleaseDates
            .Where(e => !string.IsNullOrWhiteSpace(e.Certification))
            .OrderBy(e => e.Type == 3 ? 0 : 1)
            .Select(e => e.Certification!.Trim())
            .FirstOrDefault();

        if (!string.IsNullOrEmpty(cert))
            return (Truncate(cert, 10), country);
    }
    return (string.Empty, string.Empty);
}

async Task ApplyDetailExtrasAsync(ApplicationDbContext db, Movie movie, TmdbMovieDetail detail, CancellationToken ct)
{
    // ---- Tek değerli alanlar ----
    // TMDB bilinmeyen imdb_id için null yerine "" dönebilir; IX_Movies_ImdbId unique olduğu için
    // boş string'ler birbiriyle çakışır. Bu yüzden boşsa mutlaka null'a çeviriyoruz.
    movie.ImdbId = string.IsNullOrWhiteSpace(detail.ImdbId) ? null : detail.ImdbId.Trim();
    movie.OriginalLanguage = Truncate(detail.OriginalLanguage ?? string.Empty, 10);
    movie.Tagline = Truncate(detail.Tagline ?? string.Empty, 500);
    movie.Homepage = Truncate(detail.Homepage ?? string.Empty, 500);
    movie.Budget = detail.Budget;
    movie.Revenue = detail.Revenue;
    movie.TmdbStatus = Truncate(detail.Status ?? string.Empty, 30);
    movie.TmdbPopularity = detail.Popularity;
    movie.LastTmdbSyncAt = DateTime.UtcNow;

    // ---- Türkçe çeviri (boşsa mevcut değeri ezme; okuma tarafı zaten EN'ye düşüyor) ----
    var tr = detail.Translations?.Translations
        .FirstOrDefault(t => t.Iso639_1 == "tr" && t.Iso3166_1 == "TR")
        ?? detail.Translations?.Translations.FirstOrDefault(t => t.Iso639_1 == "tr");
    var trTitle = tr?.Data?.Title;
    var trOverview = tr?.Data?.Overview;
    var trTagline = tr?.Data?.Tagline;
    if (!string.IsNullOrWhiteSpace(trTitle)) movie.TitleTr = Truncate(trTitle, 300);
    if (!string.IsNullOrWhiteSpace(trOverview)) movie.OverviewTr = Truncate(trOverview, 4000);
    if (!string.IsNullOrWhiteSpace(trTagline)) movie.TaglineTr = Truncate(trTagline, 500);

    // ---- Yaş sınırı ----
    var (certification, certificationCountry) = PickCertification(detail.ReleaseDates);
    movie.Certification = certification;
    movie.CertificationCountry = certificationCountry;

    // ---- Videolar + TrailerKey (sadece YouTube) ----
    var videos = (detail.Videos?.Results ?? new())
        .Where(v => v.Site == "YouTube" && !string.IsNullOrWhiteSpace(v.Key))
        .GroupBy(v => v.Key)
        .Select(g => g.First())
        .ToList();

    // TrailerKey tüm listeden seçilir; tabloya ise sadece en iyi birkaç Trailer/Teaser yazılır.
    movie.TrailerKey = Truncate(PickTrailerKey(videos), 50);

    movie.Videos.Clear();
    foreach (var v in videos
        .Where(v => v.Type == "Trailer" || v.Type == "Teaser")
        .OrderBy(v => v.Type == "Trailer" ? 0 : 1)
        .ThenByDescending(v => v.Official)
        .ThenBy(v => v.Iso639_1 == "tr" ? 0 : v.Iso639_1 == "en" ? 1 : 2)
        .Take(maxVideosPerMovie))
    {
        db.Add(new MovieVideo
        {
            MovieId = movie.Id,
            Key = Truncate(v.Key, 50),
            Site = "YouTube",
            Type = Truncate(v.Type, 30),
            Name = Truncate(v.Name, 200),
            Language = Truncate(v.Iso639_1 ?? string.Empty, 10),
            IsOfficial = v.Official,
            PublishedAtUtc = v.PublishedAt?.ToUniversalTime()
        });
    }

    // ---- Görseller (türe göre en yüksek oylular) ----
    movie.Images.Clear();
    void AddImages(IEnumerable<TmdbImage> source, string type, int take)
    {
        foreach (var img in source
            .Where(i => !string.IsNullOrWhiteSpace(i.FilePath))
            .OrderByDescending(i => i.VoteAverage)
            .Take(take))
        {
            db.Add(new MovieImage
            {
                MovieId = movie.Id,
                Type = type,
                FilePath = Truncate(img.FilePath, 300),
                Language = Truncate(img.Iso639_1 ?? string.Empty, 10),
                Width = img.Width,
                Height = img.Height,
                VoteAverage = img.VoteAverage
            });
        }
    }
    AddImages(detail.Images?.Posters ?? new(), "Poster", maxPostersPerMovie);
    AddImages(detail.Images?.Backdrops ?? new(), "Backdrop", maxBackdropsPerMovie);
    AddImages(detail.Images?.Logos ?? new(), "Logo", maxLogosPerMovie);

    // ---- Anahtar kelimeler (upsert + film ilişkisini yeniden kur) ----
    var tmdbKeywords = (detail.Keywords?.Keywords ?? new())
        .GroupBy(k => k.Id).Select(g => g.First()).Take(30).ToList();
    var keywordIds = tmdbKeywords.Select(k => k.Id).ToList();
    var existingKeywords = await db.Keywords
        .Where(k => keywordIds.Contains(k.TmdbId))
        .ToDictionaryAsync(k => k.TmdbId, ct);

    movie.MovieKeywords.Clear();
    foreach (var k in tmdbKeywords)
    {
        if (!existingKeywords.TryGetValue(k.Id, out var keyword))
        {
            keyword = new Keyword { TmdbId = k.Id, Name = Truncate(k.Name, 100) };
            db.Keywords.Add(keyword);
            existingKeywords[k.Id] = keyword;
        }

        var mk = new MovieKeyword { MovieId = movie.Id, KeywordId = keyword.Id };
        db.Entry(mk).State = EntityState.Added;
    }

    // ---- Yapım şirketleri (upsert + film ilişkisini yeniden kur) ----
    var tmdbCompanies = detail.ProductionCompanies
        .GroupBy(c => c.Id).Select(g => g.First()).ToList();
    var companyIds = tmdbCompanies.Select(c => c.Id).ToList();
    var existingCompanies = await db.ProductionCompanies
        .Where(c => companyIds.Contains(c.TmdbId))
        .ToDictionaryAsync(c => c.TmdbId, ct);

    movie.MovieProductionCompanies.Clear();
    foreach (var c in tmdbCompanies)
    {
        if (!existingCompanies.TryGetValue(c.Id, out var company))
        {
            company = new ProductionCompany { TmdbId = c.Id };
            db.ProductionCompanies.Add(company);
            existingCompanies[c.Id] = company;
        }
        company.Name = Truncate(c.Name, 200);
        company.LogoPath = Truncate(c.LogoPath ?? string.Empty, 300);
        company.OriginCountry = Truncate(c.OriginCountry ?? string.Empty, 10);

        var mpc = new MovieProductionCompany { MovieId = movie.Id, ProductionCompanyId = company.Id };
        db.Entry(mpc).State = EntityState.Added;
    }

    // ---- Koleksiyon (seri/üçleme) ----
    if (detail.BelongsToCollection is { } bc)
    {
        var collection = await db.MovieCollections.FirstOrDefaultAsync(c => c.TmdbId == bc.Id, ct);
        if (collection is null)
        {
            collection = new MovieCollection { TmdbId = bc.Id };
            db.MovieCollections.Add(collection);
        }
        collection.Name = Truncate(bc.Name, 200);
        collection.PosterUrl = TmdbClient.BuildImageUrl(bc.PosterPath, "w342") ?? string.Empty;
        collection.BackdropUrl = TmdbClient.BuildImageUrl(bc.BackdropPath, "w780") ?? string.Empty;
        movie.Collection = collection;
    }
    else
    {
        movie.Collection = null;
        movie.CollectionId = null;
    }

    // ---- Yapım ülkeleri (Countries tablosu başta senkronize edildi) ----
    var isoCodes = detail.ProductionCountries
        .Select(c => c.Iso31661)
        .Where(c => !string.IsNullOrWhiteSpace(c))
        .Distinct()
        .ToList();
    var countryLookup = await db.Countries
        .Where(c => isoCodes.Contains(c.IsoCode))
        .ToDictionaryAsync(c => c.IsoCode, ct);

    movie.MovieCountries.Clear();
    var countryOrder = 0;
    foreach (var iso in isoCodes)
    {
        if (countryLookup.TryGetValue(iso, out var country))
            db.Add(new MovieCountry { MovieId = movie.Id, CountryId = country.Id, Order = countryOrder++ });
    }
}

// ---------------- Opsiyonel: mevcut filmlere yeni TMDB alanlarını geri doldurma modu ----------------
// Kullanım: dotnet run --project src/UFMDb.Tools.TmdbImporter -- backfill-movie-details
// Tümünü baştan çekmek için: ... -- backfill-movie-details --force
if (args.Contains("backfill-movie-details"))
{
    await BackfillMovieDetailsAsync(dbOptions);
    return;
}

async Task BackfillMovieDetailsAsync(DbContextOptions<ApplicationDbContext> options)
{
    var force = args.Contains("--force");

    const int groupSize = 60;        // bir turda TMDB'den çekilip işlenecek film sayısı
    const int writeChunkSize = 10;   // tek SaveChanges'te yazılacak film sayısı
    const int writeParallelism = 4;  // paralel DB yazıcı sayısı (connection pool'u aşmasın)
    const int fetchParallelism = 16; // paralel TMDB isteği

    List<(Guid Id, int TmdbId)> movies;
    await using (var db = new ApplicationDbContext(options))
    {
        var query = db.Movies.Where(m => m.TmdbId != null);
        if (!force)
            query = query.Where(m => m.TitleTr == "" && !m.MovieKeywords.Any() && !m.Images.Any());

        movies = await query
            .Select(m => new ValueTuple<Guid, int>(m.Id, m.TmdbId!.Value))
            .ToListAsync(cts.Token);
    }

    Console.WriteLine($"Yeni detayları eksik {movies.Count} film bulundu{(force ? " (--force: tümü)" : "")}.\n");
    if (movies.Count == 0) return;

    var cache = new LookupCache();
    await cache.LoadAsync(options, cts.Token);
    Console.WriteLine($"Cache: {cache.Keywords.Count} keyword, {cache.Companies.Count} şirket, {cache.Collections.Count} koleksiyon, {cache.Countries.Count} ülke.\n");

    int processed = 0, updated = 0, failed = 0;
    long fetchMs = 0, sharedMs = 0, writeMs = 0;
    var total = Stopwatch.StartNew();
    var groups = movies.Chunk(groupSize).ToArray();

    async Task<TmdbMovieDetail?[]> FetchGroupAsync((Guid Id, int TmdbId)[] group)
    {
        var sw = Stopwatch.StartNew();
        var result = new TmdbMovieDetail?[group.Length];
        await Parallel.ForEachAsync(
            Enumerable.Range(0, group.Length),
            new ParallelOptions { MaxDegreeOfParallelism = fetchParallelism, CancellationToken = cts.Token },
            async (i, ct) =>
            {
                try { result[i] = await tmdb.GetMovieDetailAsync(group[i].TmdbId, ct); }
                catch (OperationCanceledException) { throw; }
                catch (Exception ex) { Console.WriteLine($"[HATA] Fetch TmdbId {group[i].TmdbId}: {ex.Message}"); }
            });
        Interlocked.Add(ref fetchMs, sw.ElapsedMilliseconds);
        return result;
    }

    try
    {
        // Pipeline: mevcut grup DB'ye yazılırken sonraki grubun TMDB istekleri arka planda çalışır.
        var nextFetch = FetchGroupAsync(groups[0]);

        for (var g = 0; g < groups.Length; g++)
        {
            cts.Token.ThrowIfCancellationRequested();

            var details = await nextFetch;
            nextFetch = g + 1 < groups.Length
                ? FetchGroupAsync(groups[g + 1])
                : Task.FromResult(Array.Empty<TmdbMovieDetail?>());

            var group = groups[g];
            var ready = new List<(Guid Id, int TmdbId, TmdbMovieDetail Detail)>();
            for (var i = 0; i < group.Length; i++)
            {
                if (details[i] is { } d) ready.Add((group[i].Id, group[i].TmdbId, d));
                else failed++;
            }

            if (ready.Count > 0)
            {
                // ---- Aşama A: paylaşılan tablolar (keyword/şirket/koleksiyon), tek thread ----
                var sw = Stopwatch.StartNew();
                var sharedOk = false;
                for (var attempt = 0; attempt < 2 && !sharedOk; attempt++)
                {
                    try
                    {
                        await UpsertSharedAsync(options, ready.Select(r => r.Detail), cache, cts.Token);
                        sharedOk = true;
                    }
                    catch (OperationCanceledException) { throw; }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"[UYARI] Paylaşılan kayıt upsert hatası (deneme {attempt + 1}): {ex.InnerException?.Message ?? ex.Message}");
                        await cache.LoadAsync(options, cts.Token); // başka süreç araya girmiş olabilir, cache'i tazele
                    }
                }
                sharedMs += sw.ElapsedMilliseconds;

                if (!sharedOk)
                {
                    failed += ready.Count;
                }
                else
                {
                    // ---- Aşama B: filme özel satırlar, lock'suz paralel ----
                    sw.Restart();
                    await Parallel.ForEachAsync(
                        ready.Chunk(writeChunkSize),
                        new ParallelOptions { MaxDegreeOfParallelism = writeParallelism, CancellationToken = cts.Token },
                        async (chunk, ct) =>
                        {
                            var (ok, bad) = await WriteChunkAsync(options, chunk, cache, force, ct);
                            Interlocked.Add(ref updated, ok);
                            Interlocked.Add(ref failed, bad);
                        });
                    writeMs += sw.ElapsedMilliseconds;
                }
            }

            processed += group.Length;
            var perMovie = total.ElapsedMilliseconds / (double)processed;
            var remaining = TimeSpan.FromMilliseconds(perMovie * (movies.Count - processed));
            Console.WriteLine(
                $"[{processed}/{movies.Count}] {updated} güncellendi, {failed} başarısız | " +
                $"fetch {fetchMs / 1000}s, shared {sharedMs / 1000}s, write {writeMs / 1000}s | kalan ~{remaining:hh\\:mm\\:ss}");
        }
    }
    catch (OperationCanceledException)
    {
        Console.WriteLine("\nDurduruldu. Tekrar çalıştırırsan kalan filmlerden devam eder.");
    }

    Console.WriteLine($"\n=== Tamamlandı — {updated} güncellendi, {failed} başarısız, süre {total.Elapsed:hh\\:mm\\:ss} ===");
}

// Paylaşılan tablolara (Keyword, ProductionCompany, MovieCollection) grup için tek seferde upsert.
// Sadece Id'leri cache'e yazar; mevcut kayıtların Name/Logo alanları güncellenmez.
async Task UpsertSharedAsync(
    DbContextOptions<ApplicationDbContext> options,
    IEnumerable<TmdbMovieDetail> details,
    LookupCache cache,
    CancellationToken ct)
{
    var newKeywords = new Dictionary<int, Keyword>();
    var newCompanies = new Dictionary<int, ProductionCompany>();
    var newCollections = new Dictionary<int, MovieCollection>();

    foreach (var d in details)
    {
        foreach (var k in (d.Keywords?.Keywords ?? new()).DistinctBy(k => k.Id).Take(30))
        {
            if (!cache.Keywords.ContainsKey(k.Id) && !newKeywords.ContainsKey(k.Id))
                newKeywords[k.Id] = new Keyword { TmdbId = k.Id, Name = Truncate(k.Name, 100) };
        }

        foreach (var c in d.ProductionCompanies.DistinctBy(c => c.Id))
        {
            if (!cache.Companies.ContainsKey(c.Id) && !newCompanies.ContainsKey(c.Id))
                newCompanies[c.Id] = new ProductionCompany
                {
                    TmdbId = c.Id,
                    Name = Truncate(c.Name, 200),
                    LogoPath = Truncate(c.LogoPath ?? string.Empty, 300),
                    OriginCountry = Truncate(c.OriginCountry ?? string.Empty, 10)
                };
        }

        if (d.BelongsToCollection is { } bc
            && !cache.Collections.ContainsKey(bc.Id) && !newCollections.ContainsKey(bc.Id))
        {
            newCollections[bc.Id] = new MovieCollection
            {
                TmdbId = bc.Id,
                Name = Truncate(bc.Name, 200),
                PosterUrl = TmdbClient.BuildImageUrl(bc.PosterPath, "w342") ?? string.Empty,
                BackdropUrl = TmdbClient.BuildImageUrl(bc.BackdropPath, "w780") ?? string.Empty
            };
        }
    }

    if (newKeywords.Count + newCompanies.Count + newCollections.Count == 0) return;

    await using var db = new ApplicationDbContext(options);
    db.Keywords.AddRange(newKeywords.Values);
    db.ProductionCompanies.AddRange(newCompanies.Values);
    db.MovieCollections.AddRange(newCollections.Values);
    await db.SaveChangesAsync(ct);

    // Cache'e sadece başarılı SaveChanges'ten sonra işle
    foreach (var (tmdbId, e) in newKeywords) cache.Keywords[tmdbId] = e.Id;
    foreach (var (tmdbId, e) in newCompanies) cache.Companies[tmdbId] = e.Id;
    foreach (var (tmdbId, e) in newCollections) cache.Collections[tmdbId] = e.Id;
}

// Bir chunk'ı tek DbContext + tek SaveChanges ile yazar. Hata olursa filmleri tek tek yeniden dener.
async Task<(int Ok, int Bad)> WriteChunkAsync(
    DbContextOptions<ApplicationDbContext> options,
    (Guid Id, int TmdbId, TmdbMovieDetail Detail)[] chunk,
    LookupCache cache,
    bool force,
    CancellationToken ct)
{
    async Task<Dictionary<Guid, Movie>> LoadMoviesAsync(ApplicationDbContext db, List<Guid> ids)
    {
        IQueryable<Movie> q = db.Movies
            .IgnoreQueryFilters()
            .Where(x => ids.Contains(x.Id))
            .Include(x => x.Videos)
            .Include(x => x.MovieProductionCompanies)
            .Include(x => x.MovieCountries);

        // Non-force modda filtre gereği bu ikisi zaten boş; yüklemeye gerek yok.
        if (force)
            q = q.Include(x => x.Images).Include(x => x.MovieKeywords);

        return await q.AsSplitQuery().ToDictionaryAsync(x => x.Id, ct);
    }

    try
    {
        await using var db = new ApplicationDbContext(options);
        var loaded = await LoadMoviesAsync(db, chunk.Select(c => c.Id).ToList());

        foreach (var c in chunk)
            if (loaded.TryGetValue(c.Id, out var m))
                ApplyMovieExtras(db, m, c.Detail, cache);

        await db.SaveChangesAsync(ct);
        return (loaded.Count, 0);
    }
    catch (OperationCanceledException) { throw; }
    catch (Exception ex)
    {
        Console.WriteLine($"[UYARI] Toplu yazım başarısız ({ex.InnerException?.Message ?? ex.Message}), filmler tek tek deneniyor...");
    }

    int ok = 0, bad = 0;
    foreach (var c in chunk)
    {
        try
        {
            await using var db = new ApplicationDbContext(options);
            var loaded = await LoadMoviesAsync(db, new List<Guid> { c.Id });
            if (!loaded.TryGetValue(c.Id, out var m)) continue;

            ApplyMovieExtras(db, m, c.Detail, cache);
            await db.SaveChangesAsync(ct);
            ok++;
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            bad++;
            Console.WriteLine($"[HATA] Movie TmdbId {c.TmdbId}: {ex.InnerException?.Message ?? ex.Message}");
        }
    }
    return (ok, bad);
}

// ApplyDetailExtrasAsync'in DB sorgusuz, cache tabanlı karşılığı.
// Paylaşılan satırlar (Keyword/Company/Collection) UpsertSharedAsync ile zaten oluşturulmuş olmalı.
// Join tablolarında Clear+Add yerine fark (diff) uygulanır: --force modunda aynı anahtarın
// hem silinip hem eklenmesinden doğan tracking çakışması olmaz.
void ApplyMovieExtras(ApplicationDbContext db, Movie movie, TmdbMovieDetail detail, LookupCache cache)
{
    // ---- Tek değerli alanlar ----
    movie.ImdbId = string.IsNullOrWhiteSpace(detail.ImdbId) ? null : detail.ImdbId.Trim();
    movie.OriginalLanguage = Truncate(detail.OriginalLanguage ?? string.Empty, 10);
    movie.Tagline = Truncate(detail.Tagline ?? string.Empty, 500);
    movie.Homepage = Truncate(detail.Homepage ?? string.Empty, 500);
    movie.Budget = detail.Budget;
    movie.Revenue = detail.Revenue;
    movie.TmdbStatus = Truncate(detail.Status ?? string.Empty, 30);
    movie.TmdbPopularity = detail.Popularity;
    movie.LastTmdbSyncAt = DateTime.UtcNow;

    // ---- Türkçe çeviri ----
    var tr = detail.Translations?.Translations
        .FirstOrDefault(t => t.Iso639_1 == "tr" && t.Iso3166_1 == "TR")
        ?? detail.Translations?.Translations.FirstOrDefault(t => t.Iso639_1 == "tr");
    if (!string.IsNullOrWhiteSpace(tr?.Data?.Title)) movie.TitleTr = Truncate(tr!.Data!.Title!, 300);
    if (!string.IsNullOrWhiteSpace(tr?.Data?.Overview)) movie.OverviewTr = Truncate(tr!.Data!.Overview!, 4000);
    if (!string.IsNullOrWhiteSpace(tr?.Data?.Tagline)) movie.TaglineTr = Truncate(tr!.Data!.Tagline!, 500);

    // ---- Yaş sınırı ----
    var (certification, certificationCountry) = PickCertification(detail.ReleaseDates);
    movie.Certification = certification;
    movie.CertificationCountry = certificationCountry;

    // ---- Videolar + TrailerKey ----
    var videos = (detail.Videos?.Results ?? new())
        .Where(v => v.Site == "YouTube" && !string.IsNullOrWhiteSpace(v.Key))
        .GroupBy(v => v.Key)
        .Select(g => g.First())
        .ToList();

    movie.TrailerKey = Truncate(PickTrailerKey(videos), 50);

    db.RemoveRange(movie.Videos.ToList());
    foreach (var v in videos
        .Where(v => v.Type == "Trailer" || v.Type == "Teaser")
        .OrderBy(v => v.Type == "Trailer" ? 0 : 1)
        .ThenByDescending(v => v.Official)
        .ThenBy(v => v.Iso639_1 == "tr" ? 0 : v.Iso639_1 == "en" ? 1 : 2)
        .Take(maxVideosPerMovie))
    {
        db.Add(new MovieVideo
        {
            MovieId = movie.Id,
            Key = Truncate(v.Key, 50),
            Site = "YouTube",
            Type = Truncate(v.Type, 30),
            Name = Truncate(v.Name, 200),
            Language = Truncate(v.Iso639_1 ?? string.Empty, 10),
            IsOfficial = v.Official,
            PublishedAtUtc = v.PublishedAt?.ToUniversalTime()
        });
    }

    // ---- Görseller ----
    db.RemoveRange(movie.Images.ToList());
    void AddImages(IEnumerable<TmdbImage> source, string type, int take)
    {
        foreach (var img in source
            .Where(i => !string.IsNullOrWhiteSpace(i.FilePath))
            .OrderByDescending(i => i.VoteAverage)
            .Take(take))
        {
            db.Add(new MovieImage
            {
                MovieId = movie.Id,
                Type = type,
                FilePath = Truncate(img.FilePath, 300),
                Language = Truncate(img.Iso639_1 ?? string.Empty, 10),
                Width = img.Width,
                Height = img.Height,
                VoteAverage = img.VoteAverage
            });
        }
    }
    AddImages(detail.Images?.Posters ?? new(), "Poster", maxPostersPerMovie);
    AddImages(detail.Images?.Backdrops ?? new(), "Backdrop", maxBackdropsPerMovie);
    AddImages(detail.Images?.Logos ?? new(), "Logo", maxLogosPerMovie);

    // ---- Anahtar kelimeler (diff) ----
    var wantedKeywords = (detail.Keywords?.Keywords ?? new())
        .DistinctBy(k => k.Id).Take(30)
        .Select(k => cache.Keywords.TryGetValue(k.Id, out var id) ? id : (Guid?)null)
        .Where(id => id.HasValue).Select(id => id!.Value)
        .ToHashSet();

    foreach (var mk in movie.MovieKeywords.Where(x => !wantedKeywords.Contains(x.KeywordId)).ToList())
        db.Remove(mk);
    var haveKeywords = movie.MovieKeywords.Select(x => x.KeywordId).ToHashSet();
    foreach (var id in wantedKeywords.Where(id => !haveKeywords.Contains(id)))
        db.Add(new MovieKeyword { MovieId = movie.Id, KeywordId = id });

    // ---- Yapım şirketleri (diff) ----
    var wantedCompanies = detail.ProductionCompanies
        .DistinctBy(c => c.Id)
        .Select(c => cache.Companies.TryGetValue(c.Id, out var id) ? id : (Guid?)null)
        .Where(id => id.HasValue).Select(id => id!.Value)
        .ToHashSet();

    foreach (var mpc in movie.MovieProductionCompanies.Where(x => !wantedCompanies.Contains(x.ProductionCompanyId)).ToList())
        db.Remove(mpc);
    var haveCompanies = movie.MovieProductionCompanies.Select(x => x.ProductionCompanyId).ToHashSet();
    foreach (var id in wantedCompanies.Where(id => !haveCompanies.Contains(id)))
        db.Add(new MovieProductionCompany { MovieId = movie.Id, ProductionCompanyId = id });

    // ---- Koleksiyon (sadece FK; navigation yüklemeye gerek yok) ----
    movie.CollectionId = detail.BelongsToCollection is { } bc && cache.Collections.TryGetValue(bc.Id, out var colId)
        ? colId
        : null;

    // ---- Yapım ülkeleri (diff + sıra güncelleme) ----
    var wantedCountries = new List<(Guid Id, int Order)>();
    var countryOrder = 0;
    foreach (var iso in detail.ProductionCountries
        .Select(c => c.Iso31661)
        .Where(c => !string.IsNullOrWhiteSpace(c))
        .Distinct())
    {
        if (cache.Countries.TryGetValue(iso, out var countryId))
            wantedCountries.Add((countryId, countryOrder++));
    }

    var wantedCountryIds = wantedCountries.Select(w => w.Id).ToHashSet();
    foreach (var mc in movie.MovieCountries.Where(x => !wantedCountryIds.Contains(x.CountryId)).ToList())
        db.Remove(mc);
    var haveCountries = movie.MovieCountries.ToDictionary(x => x.CountryId);
    foreach (var (id, order) in wantedCountries)
    {
        if (haveCountries.TryGetValue(id, out var existing)) existing.Order = order;
        else db.Add(new MovieCountry { MovieId = movie.Id, CountryId = id, Order = order });
    }
}

async Task EnrichBatchAsync(DbContextOptions<ApplicationDbContext> options, List<(Guid Id, int TmdbId)> people, bool isActor)
{
    int processed = 0, updated = 0, failed = 0;

    foreach (var person in people)
    {
        if (cts.IsCancellationRequested) break;
        processed++;

        try
        {
            var detail = await tmdb.GetPersonDetailAsync(person.TmdbId, cts.Token);
            if (detail is null) { failed++; continue; }

            var biography = Truncate(detail.Biography ?? string.Empty, 4000);
            var birthDate = ParseUtcDate(detail.Birthday);

            // Yaklaşık uyruk: place_of_birth genelde "Şehir, Eyalet, Ülke" formatında —
            // virgülle bölüp son parçayı alıyoruz. Format tutarsızsa yanlış olabilir.
            var nationality = detail.PlaceOfBirth
                ?.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
                .LastOrDefault() ?? string.Empty;

            await using var db = new ApplicationDbContext(options);

            if (isActor)
            {
                var actor = await db.Actors.FindAsync(new object[] { person.Id }, cts.Token);
                if (actor is null) continue;
                actor.Biography = biography;
                actor.BirthDate = birthDate;
                actor.Nationality = nationality;
            }
            else
            {
                var director = await db.Directors.FindAsync(new object[] { person.Id }, cts.Token);
                if (director is null) continue;
                director.Biography = biography;
                director.BirthDate = birthDate;
                director.Nationality = nationality;
            }

            await db.SaveChangesAsync(cts.Token);
            updated++;

            if (processed % 50 == 0 || processed == people.Count)
                Console.WriteLine($"[{processed}/{people.Count}] işlendi — {updated} güncellendi, {failed} başarısız.");

            await Task.Delay(120, cts.Token); // TMDB rate limit'ine karşı temkinli bekleme
        }
        catch (Exception ex)
        {
            failed++;
            Console.WriteLine($"[HATA] Person TMDB ID {person.TmdbId}: {ex.Message}");
        }
    }
}

// ---------------- 1. Türleri senkronize et ----------------
Console.WriteLine("Türler senkronize ediliyor...");
var genreMap = new Dictionary<int, Guid>(); // TMDB genre id -> bizim Genre.Id

await using (var db = new ApplicationDbContext(dbOptions))
{
    var tmdbGenres = await tmdb.GetGenresAsync(cts.Token);
    var localGenres = await db.Genres.ToListAsync(cts.Token);

    foreach (var tg in tmdbGenres.Genres)
    {
        var alias = nameAliases.GetValueOrDefault(tg.Name, tg.Name);
        var match = localGenres.FirstOrDefault(g => g.TmdbId == tg.Id)
            ?? localGenres.FirstOrDefault(g => g.Name.Equals(alias, StringComparison.OrdinalIgnoreCase) && g.TmdbId is null);

        if (match is null)
        {
            match = new Genre
            {
                Name = tg.Name,
                NameTr = genreTranslations.GetValueOrDefault(tg.Name, tg.Name),
                TmdbId = tg.Id
            };
            db.Genres.Add(match);
            localGenres.Add(match);
        }
        else if (match.TmdbId is null)
        {
            match.TmdbId = tg.Id; // önceden seed edilmiş genre'yi TMDB'ye bağla
        }

        genreMap[tg.Id] = match.Id;
    }

    await db.SaveChangesAsync(cts.Token);
    Console.WriteLine($"{genreMap.Count} tür senkronize edildi.\n");
}

// ---------------- 1.5. Ülkeleri senkronize et ----------------
Console.WriteLine("Ülkeler senkronize ediliyor...");

await using (var db = new ApplicationDbContext(dbOptions))
{
    var tmdbCountries = await tmdb.GetCountriesConfigAsync(cts.Token);
    var localCountries = await db.Countries.ToListAsync(cts.Token);
    var syncedCount = 0;

    foreach (var tc in tmdbCountries)
    {
        var match = localCountries.FirstOrDefault(c => c.IsoCode == tc.Iso3166_1);

        if (match is null)
        {
            match = new Country
            {
                IsoCode = tc.Iso3166_1,
                Name = tc.EnglishName,
                NameTr = countryTranslations.GetValueOrDefault(tc.EnglishName, tc.EnglishName)
            };
            db.Countries.Add(match);
            localCountries.Add(match);
        }
        else
        {
            // İsim TMDB'de değişmiş olabilir, güncel tut
            match.Name = tc.EnglishName;
            if (countryTranslations.TryGetValue(tc.EnglishName, out var tr))
                match.NameTr = tr;
        }
        syncedCount++;
    }

    await db.SaveChangesAsync(cts.Token);
    Console.WriteLine($"{syncedCount} ülke senkronize edildi.\n");
}

// ---------------- Ortak: veritabanındaki mevcut TmdbId'leri getir ----------------
async Task<HashSet<int>> GetExistingTmdbIdsAsync(DbContextOptions<ApplicationDbContext> options)
{
    await using var db = new ApplicationDbContext(options);
    var ids = await db.Movies.Where(m => m.TmdbId != null)
        .Select(m => m.TmdbId!.Value)
        .ToListAsync(cts.Token);
    return ids.ToHashSet();
}

// Soft-delete edilmiş filmler DAHİL tüm TmdbId'ler. ImportMoviesAsync "bu film DB'de var mı?" kararını
// buna göre verir: yoksa pahalı Include'lu sorguyu hiç atmaz, varsa (silinmiş olsa bile) yükleyip günceller.
async Task<HashSet<int>> GetAllTmdbIdsIncludingDeletedAsync(DbContextOptions<ApplicationDbContext> options)
{
    await using var db = new ApplicationDbContext(options);
    var ids = await db.Movies.IgnoreQueryFilters()
        .Where(m => m.TmdbId != null)
        .Select(m => m.TmdbId!.Value)
        .ToListAsync(cts.Token);
    return ids.ToHashSet();
}

// ---------------- Ortak: TMDB discover ile benzersiz film ID'si topla ----------------
async Task<List<int>> DiscoverUniqueMovieIdsAsync(
    int targetCount,
    HashSet<int> existingTmdbIds,
    string sortBy,
    int minVoteCountFilter,
    string? releaseDateGte = null,
    string? releaseDateLte = null,
    string? originCountry = null)
{
    var newIds = new List<int>();
    var seen = new HashSet<int>();
    var page = 1;

    while (newIds.Count < targetCount && !cts.IsCancellationRequested)
    {
        var discoverResult = await tmdb.DiscoverMoviesAsync(
            page,
            minVoteCountFilter,
            cts.Token,
            releaseDateGte,
            releaseDateLte,
            sortBy,
            originCountry);
        if (discoverResult.Results.Count == 0) break;

        foreach (var r in discoverResult.Results)
        {
            if (existingTmdbIds.Contains(r.Id) || !seen.Add(r.Id)) continue;
            newIds.Add(r.Id);
            if (newIds.Count >= targetCount) break;
        }

        page++;
        if (page > discoverResult.TotalPages) break;
        await Task.Delay(150, cts.Token);
    }

    return newIds;
}

// ---------------- Ortak: verilen TMDB ID listesini işleyip veritabanına upsert et ----------------
// Hız notları:
//  - TMDB istekleri tmdbFetchBatchSize'lık gruplar halinde PARALEL çekilir; DB yazımı sıralı kalır.
//  - Oyuncu/yönetmenler tek sorguyla toplu yüklenir, film başına tek SaveChanges yapılır.
//  - DB'de olmayan (yeni) filmler için Include'lu sorgu atlanır.
async Task ImportMoviesAsync(List<int> movieIds, Dictionary<int, Guid> genreMapping)
{
    int processed = 0, created = 0, updated = 0, failed = 0;

    var knownTmdbIds = await GetAllTmdbIdsIncludingDeletedAsync(dbOptions);

    foreach (var chunk in movieIds.Chunk(tmdbFetchBatchSize))
    {
        if (cts.IsCancellationRequested) break;

        TmdbMovieDetail?[] details;
        try
        {
            details = await Task.WhenAll(chunk.Select(id => tmdb.GetMovieDetailAsync(id, cts.Token)));
        }
        catch (OperationCanceledException)
        {
            break;
        }

        for (var i = 0; i < chunk.Length; i++)
        {
            if (cts.IsCancellationRequested) break;

            var tmdbId = chunk[i];
            var detail = details[i];
            processed++;

            try
            {
                if (detail is null) { failed++; continue; }

                await using var db = new ApplicationDbContext(dbOptions);

                // NOT: IgnoreQueryFilters() şart — "IX_Movies_TmdbId" unique index'i IsDeleted'a göre
                // partial değil (sadece "TmdbId IS NOT NULL" filtreli), yani admin panelinden
                // soft-delete edilmiş bir film bile o TmdbId'yi işgal etmeye devam eder. Normal
                // sorgu (global query filter yüzünden) böyle bir satırı görmez, isNew=true sanılır
                // ve INSERT "duplicate key value violates unique constraint IX_Movies_TmdbId" ile patlar.
                // IgnoreQueryFilters ile soft-delete edilmiş satırı da buluyoruz; TMDB'de hâlâ varsa
                // (importer'ın amacı zaten bu) IsDeleted'ı geri açıp üzerine güncelliyoruz.
                Movie? movie = null;
                if (knownTmdbIds.Contains(tmdbId))
                {
                    movie = await db.Movies
                        .IgnoreQueryFilters()
                        .Include(m => m.MovieGenres)
                        .Include(m => m.MovieActors)
                        .Include(m => m.MovieDirectors)
                        .Include(m => m.Videos)
                        .Include(m => m.Images)
                        .Include(m => m.MovieKeywords)
                        .Include(m => m.MovieProductionCompanies)
                        .Include(m => m.MovieCountries)
                        .Include(m => m.Collection)
                        .AsSplitQuery()
                        .FirstOrDefaultAsync(m => m.TmdbId == tmdbId, cts.Token);
                }

                var isNew = movie is null;
                var wasSoftDeleted = movie?.IsDeleted ?? false;
                movie ??= new Movie { TmdbId = tmdbId };
                if (wasSoftDeleted)
                {
                    movie.IsDeleted = false;
                    Console.WriteLine($"[BİLGİ] TMDB ID {tmdbId} daha önce silinmişti (soft-delete), TMDB'de hâlâ bulunduğu için yeniden aktif ediliyor.");
                }

                movie.Title = detail.Title;
                movie.OriginalTitle = string.IsNullOrWhiteSpace(detail.OriginalTitle) ? detail.Title : detail.OriginalTitle;
                movie.Overview = Truncate(detail.Overview, 4000);
                movie.ReleaseDate = ParseUtcDate(detail.ReleaseDate) ?? DateTime.UtcNow;
                movie.ReleaseYear = movie.ReleaseDate.Year;
                movie.RuntimeMinutes = detail.Runtime ?? 0;
                movie.PosterUrl = TmdbClient.BuildImageUrl(detail.PosterPath, "w500") ?? string.Empty;
                movie.BackdropUrl = TmdbClient.BuildImageUrl(detail.BackdropPath, "w1280") ?? string.Empty;
                movie.Country = detail.ProductionCountries.FirstOrDefault()?.Name ?? string.Empty;

                // NOT: SeedRating/SeedVoteCount, TMDB'nin izleyici puanını hiç değişmeyen bir "çapa" olarak
                // saklar (TMDB 0-10 -> bizim 0-5 ölçeği). AverageRating/RatingCount ise
                // MovieRatingRecalculator.RecalculateAsync ile hesaplanır — bu sayede bu import/refresh akışı
                // sitede birikmiş yerel puanları (MovieRatings) asla ezmez, sadece TMDB tarafını güncelleyip
                // yeniden karıştırır.
                movie.SeedRating = Math.Round(detail.VoteAverage / 2.0, 2);
                movie.SeedVoteCount = detail.VoteCount;

                // ViewCount sadece yeni filmde başlangıç değeri olarak atanır; refresh'te gerçek
                // görüntülenme sayısını sıfırlamamak için mevcut filmlere dokunmuyoruz.
                if (isNew)
                {
                    movie.ViewCount = detail.VoteCount;

                    // Lifecycle durumunu ReleaseDate'e göre otomatik ata.
                    // Mevcut filmleri güncellerken durumu ezmiyoruz — o iş refresh-* job'larının sorumluluğunda.
                    movie.LifecycleStatus = movie.ReleaseDate.Date > DateTime.UtcNow.Date
                        ? MovieLifecycleStatus.Upcoming
                        : MovieLifecycleStatus.Stable;
                }

                if (isNew) db.Movies.Add(movie);

                // imdb_id, bütçe, TR çeviri, video, görsel, keyword, şirket, koleksiyon, ülke, yaş sınırı...
                await ApplyDetailExtrasAsync(db, movie, detail, cts.Token);

                await MovieRatingRecalculator.RecalculateAsync(db, movie, cts.Token);

                // ---- Türler (temizle + yeniden kur) ----
                movie.MovieGenres.Clear();
                foreach (var g in detail.Genres)
                {
                    if (genreMapping.TryGetValue(g.Id, out var localGenreId))
                        movie.MovieGenres.Add(new MovieGenre { GenreId = localGenreId });
                }

                // ---- Oyuncu kadrosu (toplu yükle + temizle + yeniden kur) ----
                movie.MovieActors.Clear();
                var castMembers = (detail.Credits?.Cast ?? new())
                    .OrderBy(c => c.Order)
                    .DistinctBy(c => c.Id)
                    .Take(castLimit)
                    .ToList();
                var castIds = castMembers.Select(c => c.Id).ToList();
                var actorsByTmdbId = await db.Actors
                    .Where(a => a.TmdbId != null && castIds.Contains(a.TmdbId.Value))
                    .ToDictionaryAsync(a => a.TmdbId!.Value, cts.Token);

                foreach (var cast in castMembers)
                {
                    if (!actorsByTmdbId.TryGetValue(cast.Id, out var actor))
                    {
                        actor = new Actor
                        {
                            TmdbId = cast.Id,
                            FullName = cast.Name,
                            PhotoUrl = TmdbClient.BuildImageUrl(cast.ProfilePath, "w300") ?? string.Empty
                        };
                        db.Actors.Add(actor);
                        actorsByTmdbId[cast.Id] = actor;
                    }

                    // Navigation üzerinden bağlıyoruz: yeni aktörün Id'si SaveChanges'te fixup ile gelir.
                    movie.MovieActors.Add(new MovieActor
                    {
                        Actor = actor,
                        CharacterName = cast.Character ?? string.Empty,
                        Order = cast.Order
                    });
                }

                // ---- Yönetmenler (toplu yükle + temizle + yeniden kur) ----
                movie.MovieDirectors.Clear();
                var directingCrew = (detail.Credits?.Crew ?? new())
                    .Where(c => c.Job == "Director")
                    .DistinctBy(c => c.Id)
                    .ToList();
                var directorIds = directingCrew.Select(c => c.Id).ToList();
                var directorsByTmdbId = await db.Directors
                    .Where(d => d.TmdbId != null && directorIds.Contains(d.TmdbId.Value))
                    .ToDictionaryAsync(d => d.TmdbId!.Value, cts.Token);

                var directorOrder = 0;
                foreach (var crewMember in directingCrew)
                {
                    if (!directorsByTmdbId.TryGetValue(crewMember.Id, out var director))
                    {
                        director = new Director
                        {
                            TmdbId = crewMember.Id,
                            FullName = crewMember.Name,
                            PhotoUrl = TmdbClient.BuildImageUrl(crewMember.ProfilePath, "w300") ?? string.Empty
                        };
                        db.Directors.Add(director);
                        directorsByTmdbId[crewMember.Id] = director;
                    }

                    movie.MovieDirectors.Add(new MovieDirector
                    {
                        Director = director,
                        Order = directorOrder++
                    });
                }

                // Film başına TEK SaveChanges
                await db.SaveChangesAsync(cts.Token);

                knownTmdbIds.Add(tmdbId);
                if (isNew) created++; else updated++;

                if (processed % 20 == 0 || processed == movieIds.Count)
                    Console.WriteLine($"[{processed}/{movieIds.Count}] işlendi — {created} yeni, {updated} güncellendi, {failed} başarısız. Son: {movie.Title} ({movie.ReleaseYear})");
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                failed++;
                Console.WriteLine($"[HATA] TMDB ID {tmdbId}: {ex.Message}");
                var inner = ex.InnerException;
                while (inner is not null)
                {
                    Console.WriteLine($"   -> INNER: {inner.GetType().Name}: {inner.Message}");
                    inner = inner.InnerException;
                }
            }
        }
    }

    Console.WriteLine("\n=== Tamamlandı ===");
    Console.WriteLine($"Toplam işlenen: {processed} | Yeni: {created} | Güncellenen: {updated} | Başarısız: {failed}");
}

// ---------------- Opsiyonel: henüz vizyona girmemiş filmleri çekme modu ----------------
// Kullanım: dotnet run --project src/UFMDb.Tools.TmdbImporter -- fetch-upcoming
if (args.Contains("fetch-upcoming"))
{
    await FetchUpcomingMoviesAsync();
    return;
}

async Task FetchUpcomingMoviesAsync()
{
    Console.WriteLine($"Henüz vizyona girmemiş {upcomingMovieCount} film TMDB'den çekiliyor (yakında çıkacak filmler için)...\n");

    var existingTmdbIds = await GetExistingTmdbIdsAsync(dbOptions);
    Console.WriteLine($"Veritabanında {existingTmdbIds.Count} film zaten mevcut.\n");

    var today = DateTime.UtcNow.Date;
    var gte = today.AddDays(1).ToString("yyyy-MM-dd");           // yarından itibaren
    var lte = today.AddDays(upcomingWindowDays).ToString("yyyy-MM-dd"); // aşırı uzak/placeholder tarihleri ayıklamak için bir üst sınır

    // Henüz vizyona girmemiş filmlerin oy sayısı olmadığı/çok az olduğu için sıralamayı
    // popülerliğe göre yapıyoruz, oy sayısı filtresi uygulamıyoruz (minVoteCountFilter: 0).
    var newIds = await DiscoverUniqueMovieIdsAsync(
        targetCount: upcomingMovieCount,
        existingTmdbIds: existingTmdbIds,
        sortBy: "popularity.desc",
        minVoteCountFilter: 0,
        releaseDateGte: gte,
        releaseDateLte: lte);

    Console.WriteLine($"{newIds.Count} yeni yaklaşan film ID'si bulundu.\n");

    if (newIds.Count == 0)
    {
        Console.WriteLine("İşlenecek yeni film yok, çıkılıyor.");
        return;
    }

    await ImportMoviesAsync(newIds, genreMap);
}

// ---------------- Opsiyonel: vizyona yeni giren filmleri yeniden çekme modu ----------------
// Kullanım: dotnet run --project src/UFMDb.Tools.TmdbImporter -- refresh-released
if (args.Contains("refresh-released"))
{
    await RefreshNewlyReleasedMoviesAsync(dbOptions);
    return;
}

async Task RefreshNewlyReleasedMoviesAsync(DbContextOptions<ApplicationDbContext> options)
{
    var today = DateTime.UtcNow.Date;

    List<int> tmdbIdsToRefresh;
    await using (var db = new ApplicationDbContext(options))
    {
        tmdbIdsToRefresh = await db.Movies
            .Where(m => m.TmdbId != null
                     && m.LifecycleStatus == MovieLifecycleStatus.Upcoming
                     && m.ReleaseDate <= today)
            .Select(m => m.TmdbId!.Value)
            .ToListAsync(cts.Token);
    }

    Console.WriteLine($"Vizyon tarihi geçmiş ve hâlâ 'Upcoming' durumunda olan {tmdbIdsToRefresh.Count} film bulundu.\n");

    if (tmdbIdsToRefresh.Count == 0)
    {
        Console.WriteLine("Güncellenecek film yok, çıkılıyor.");
        return;
    }

    await ImportMoviesAsync(tmdbIdsToRefresh, genreMap);

    await using var db2 = new ApplicationDbContext(options);
    var movies = await db2.Movies
        .Where(m => m.TmdbId != null && tmdbIdsToRefresh.Contains(m.TmdbId!.Value))
        .ToListAsync(cts.Token);

    var now = DateTime.UtcNow;
    foreach (var m in movies)
    {
        m.LifecycleStatus = MovieLifecycleStatus.NewlyReleased;
        m.LastTmdbSyncAt = now;
    }
    await db2.SaveChangesAsync(cts.Token);

    Console.WriteLine($"{movies.Count} film 'NewlyReleased' durumuna geçirildi.");
}

// ---------------- Tek seferlik: mevcut kayıtların LifecycleStatus'unu ReleaseDate'e göre düzelt ----------------
// Kullanım: dotnet run --project src/UFMDb.Tools.TmdbImporter -- backfill-lifecycle
if (args.Contains("backfill-lifecycle"))
{
    await using var db = new ApplicationDbContext(dbOptions);
    var today = DateTime.UtcNow.Date;

    var upcomingCount = await db.Movies
        .Where(m => m.ReleaseDate.Date > today && m.LifecycleStatus != MovieLifecycleStatus.Upcoming)
        .ExecuteUpdateAsync(s => s.SetProperty(m => m.LifecycleStatus, MovieLifecycleStatus.Upcoming), cts.Token);

    Console.WriteLine($"{upcomingCount} film 'Upcoming' olarak işaretlendi.");
    return;
}

// ---------------- Opsiyonel: vizyondan belirli süre sonra tekrar çekme modu ----------------
// Kullanım: dotnet run --project src/UFMDb.Tools.TmdbImporter -- refresh-post-release
if (args.Contains("refresh-post-release"))
{
    await RefreshPostReleaseMoviesAsync(dbOptions);
    return;
}

// Kullanım: dotnet run --project src/UFMDb.Tools.TmdbImporter -- refresh-checkpoints
if (args.Contains("refresh-checkpoints"))
{
    await RefreshCheckpointMoviesAsync(dbOptions);
    return;
}

// Günlük tek komut: üç aşamayı doğru sırayla çalıştırır.
// Kullanım: dotnet run --project src/UFMDb.Tools.TmdbImporter -- daily-sync
if (args.Contains("daily-sync"))
{
    await RefreshNewlyReleasedMoviesAsync(dbOptions);   // Upcoming -> NewlyReleased (gün 0)
    await RefreshCheckpointMoviesAsync(dbOptions);      // gün 3, gün 10, ... (ayarlanabilir)
    await RefreshPostReleaseMoviesAsync(dbOptions);     // gün 30+ -> Stable
    return;
}

async Task RefreshCheckpointMoviesAsync(DbContextOptions<ApplicationDbContext> options)
{
    var now = DateTime.UtcNow;
    var stableCutoff = now.Date.AddDays(-postReleaseRefreshDays);

    List<int> dueTmdbIds;
    await using (var db = new ApplicationDbContext(options))
    {
        var candidates = await db.Movies
            .Where(m => m.TmdbId != null && m.LifecycleStatus == MovieLifecycleStatus.NewlyReleased)
            .Select(m => new { TmdbId = m.TmdbId!.Value, m.ReleaseDate, m.LastTmdbSyncAt })
            .ToListAsync(cts.Token);

        // Bir film, vizyon tarihi + d gününe ulaştıysa VE son senkronu o noktadan öncesiyse "vadesi gelmiş" sayılır.
        // Son senkron o noktadan sonraysa (ör. refresh-released geç çalıştıysa) aynı veriyi tekrar çekmeyiz.
        // 30 gün geçmiş filmleri refresh-post-release üstleniyor, burada çift çağrı olmasın diye dışarıda bırakıyoruz.
        dueTmdbIds = candidates
            .Where(c => c.ReleaseDate.Date > stableCutoff)
            .Where(c =>
            {
                var last = c.LastTmdbSyncAt ?? DateTime.MinValue;
                return refreshCheckpointDays.Any(d =>
                {
                    var checkpoint = c.ReleaseDate.Date.AddDays(d);
                    return checkpoint <= now && last < checkpoint;
                });
            })
            .Select(c => c.TmdbId)
            .ToList();
    }

    Console.WriteLine($"Kontrol noktası ({string.Join(", ", refreshCheckpointDays)}. gün) vadesi gelmiş {dueTmdbIds.Count} film bulundu.\n");

    if (dueTmdbIds.Count == 0)
    {
        Console.WriteLine("Güncellenecek film yok, çıkılıyor.");
        return;
    }

    await ImportMoviesAsync(dueTmdbIds, genreMap);

    // Durum (NewlyReleased) değişmiyor; sadece son senkron zamanı güncelleniyor.
    await using var db2 = new ApplicationDbContext(options);
    var movies = await db2.Movies
        .Where(m => m.TmdbId != null && dueTmdbIds.Contains(m.TmdbId!.Value))
        .ToListAsync(cts.Token);

    var syncedAt = DateTime.UtcNow;
    foreach (var m in movies)
        m.LastTmdbSyncAt = syncedAt;
    await db2.SaveChangesAsync(cts.Token);

    Console.WriteLine($"{movies.Count} filmin son senkron zamanı güncellendi.");
}

async Task RefreshPostReleaseMoviesAsync(DbContextOptions<ApplicationDbContext> options)
{
    var cutoff = DateTime.UtcNow.Date.AddDays(-postReleaseRefreshDays);

    List<int> tmdbIdsToRefresh;
    await using (var db = new ApplicationDbContext(options))
    {
        tmdbIdsToRefresh = await db.Movies
            .Where(m => m.TmdbId != null
                     && m.LifecycleStatus == MovieLifecycleStatus.NewlyReleased
                     && m.ReleaseDate <= cutoff)
            .Select(m => m.TmdbId!.Value)
            .ToListAsync(cts.Token);
    }

    Console.WriteLine($"Vizyona girmesinin üzerinden {postReleaseRefreshDays}+ gün geçmiş ve hâlâ 'NewlyReleased' durumunda olan {tmdbIdsToRefresh.Count} film bulundu.\n");

    if (tmdbIdsToRefresh.Count == 0)
    {
        Console.WriteLine("Güncellenecek film yok, çıkılıyor.");
        return;
    }

    await ImportMoviesAsync(tmdbIdsToRefresh, genreMap);

    await using var db2 = new ApplicationDbContext(options);
    var movies = await db2.Movies
        .Where(m => m.TmdbId != null && tmdbIdsToRefresh.Contains(m.TmdbId!.Value))
        .ToListAsync(cts.Token);

    var now = DateTime.UtcNow;
    foreach (var m in movies)
    {
        m.LifecycleStatus = MovieLifecycleStatus.Stable;
        m.PostReleaseSyncedAt = now;
        m.LastTmdbSyncAt = now;
    }
    await db2.SaveChangesAsync(cts.Token);

    Console.WriteLine($"{movies.Count} film 'Stable' durumuna geçirildi.");
}

// ---------------- Opsiyonel: en yüksek oy sayısına sahip Türk filmlerini çekme modu ----------------
// Kullanım: dotnet run --project src/UFMDb.Tools.TmdbImporter -- fetch-turkish
if (args.Contains("fetch-turkish"))
{
    await FetchTurkishMoviesAsync();
    return;
}

async Task FetchTurkishMoviesAsync()
{
    Console.WriteLine(
        $"TMDB'den oy sayısına göre en yüksek {turkishMovieCount} yeni Türk filmi bulunuyor...\n");

    var existingTmdbIds = await GetExistingTmdbIdsAsync(dbOptions);

    Console.WriteLine(
        $"Veritabanında {existingTmdbIds.Count} film zaten mevcut.\n");

    var newIds = await DiscoverUniqueMovieIdsAsync(
        targetCount: turkishMovieCount,
        existingTmdbIds: existingTmdbIds,
        sortBy: "vote_count.desc",
        minVoteCountFilter: minVoteCount,
        originCountry: "TR");

    Console.WriteLine(
        $"\nToplam {newIds.Count} yeni Türk filmi bulundu.\n");

    if (newIds.Count == 0)
    {
        Console.WriteLine("İşlenecek yeni Türk filmi yok, çıkılıyor.");
        return;
    }

    await ImportMoviesAsync(newIds, genreMap);
}

// ---------------- 2. Ana akış: oy sayısına göre yüksekten aza, yıl filtresiz, benzersiz film çekimi ----------------
Console.WriteLine("Mevcut filmler kontrol ediliyor...");
var existingIds = await GetExistingTmdbIdsAsync(dbOptions);
Console.WriteLine($"Veritabanında {existingIds.Count} film zaten mevcut.\n");

var yearRangeLabel = yearFrom is null && yearTo is null
    ? "yıl filtresi olmadan"
    : $"yıl filtresiyle ({yearFrom?.ToString() ?? "-∞"} - {yearTo?.ToString() ?? "∞"})";
Console.WriteLine($"TMDB'den oy sayısına göre (yüksekten aza) {yearRangeLabel} {targetMovieCount} benzersiz film ID'si toplanıyor (min. oy sayısı: {minVoteCount})...");
var movieIds = await DiscoverUniqueMovieIdsAsync(
    targetCount: targetMovieCount,
    existingTmdbIds: existingIds,
    sortBy: "vote_count.desc",
    minVoteCountFilter: minVoteCount,
    releaseDateGte: releaseDateGte,
    releaseDateLte: releaseDateLte);

Console.WriteLine($"Toplam {movieIds.Count} yeni film ID'si toplandı.\n");

if (movieIds.Count == 0)
{
    Console.WriteLine("İşlenecek yeni film yok, çıkılıyor.");
    return;
}

await ImportMoviesAsync(movieIds, genreMap);

static string Truncate(string value, int maxLength) =>
    string.IsNullOrEmpty(value) ? value : (value.Length <= maxLength ? value : value[..maxLength]);

sealed class LookupCache
{
    public Dictionary<int, Guid> Keywords { get; private set; } = new();
    public Dictionary<int, Guid> Companies { get; private set; } = new();
    public Dictionary<int, Guid> Collections { get; private set; } = new();
    public Dictionary<string, Guid> Countries { get; private set; } = new();

    public async Task LoadAsync(DbContextOptions<ApplicationDbContext> options, CancellationToken ct)
    {
        await using var db = new ApplicationDbContext(options);
        Keywords = await db.Keywords.ToDictionaryAsync(k => k.TmdbId, k => k.Id, ct);
        Companies = await db.ProductionCompanies.ToDictionaryAsync(c => c.TmdbId, c => c.Id, ct);
        Collections = await db.MovieCollections.ToDictionaryAsync(c => c.TmdbId, c => c.Id, ct);
        Countries = await db.Countries.ToDictionaryAsync(c => c.IsoCode, c => c.Id, ct);
    }
}