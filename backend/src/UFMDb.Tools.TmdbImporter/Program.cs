using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using UFMDb.Domain.Entities;
using UFMDb.Persistence;
using UFMDb.Tools.TmdbImporter;

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
var upcomingMovieCount = int.Parse(configuration["Tmdb:UpcomingMovieCount"] ?? "50");
var upcomingWindowDays = int.Parse(configuration["Tmdb:UpcomingWindowDays"] ?? "180");
var turkishMovieCount = int.Parse(configuration["Tmdb:TurkishMovieCount"] ?? "200");
var castLimit = 12; // her filmden alınacak maksimum oyuncu sayısı

if (string.IsNullOrWhiteSpace(apiKey) || apiKey == "REPLACE_WITH_YOUR_TMDB_API_KEY")
{
    Console.WriteLine("HATA: appsettings.json içindeki Tmdb:ApiKey alanını gerçek TMDB API anahtarınla değiştir.");
    return;
}

// TMDB'nin standart 19 tür adı için TR çeviri sözlüğü (yeni oluşturulan türlerde kullanılır)
var genreTranslations = new Dictionary<string, string>
{
    ["Action"] = "Aksiyon", ["Adventure"] = "Macera", ["Animation"] = "Animasyon", ["Comedy"] = "Komedi",
    ["Crime"] = "Suç", ["Documentary"] = "Belgesel", ["Drama"] = "Dram", ["Family"] = "Aile",
    ["Fantasy"] = "Fantastik", ["History"] = "Tarih", ["Horror"] = "Korku", ["Music"] = "Müzik",
    ["Mystery"] = "Gizem", ["Romance"] = "Romantik", ["Science Fiction"] = "Bilim Kurgu",
    ["TV Movie"] = "TV Filmi", ["Thriller"] = "Gerilim", ["War"] = "Savaş", ["Western"] = "Vahşi Batı"
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

async Task ResetMoviesAsync(DbContextOptions<ApplicationDbContext> options)
{
    await using var db = new ApplicationDbContext(options);
    Console.WriteLine("Tüm filmler ve ilişkili veriler siliniyor...\n");

    // Restrict ilişkileri önce temizle (Movie silme işlemi FK hatası vermesin diye)
    var deletedCuratedItems = await db.Database.ExecuteSqlRawAsync("DELETE FROM CuratedListItems");
    await db.Database.ExecuteSqlRawAsync("DELETE FROM CuratedLists");
    var deletedFavorites = await db.Database.ExecuteSqlRawAsync("DELETE FROM FavoriteMovies");
    var deletedWatchHistory = await db.Database.ExecuteSqlRawAsync("DELETE FROM WatchHistory");

    // Movie silinince Review/Like/WatchlistItem/MovieGenre/MovieActor/MovieDirector cascade ile gider
    var deletedMovies = await db.Database.ExecuteSqlRawAsync("DELETE FROM Movies");

    // Artık hiçbir filmde olmayan aktör/yönetmenleri temizle
    var deletedFavoriteActors = await db.Database.ExecuteSqlRawAsync(
        "DELETE FROM FavoriteActors WHERE ActorId IN (SELECT a.Id FROM Actors a WHERE NOT EXISTS (SELECT 1 FROM MovieActors ma WHERE ma.ActorId = a.Id))");
    var deletedActorLikes = await db.Database.ExecuteSqlRawAsync(
        "DELETE FROM ActorLikes WHERE ActorId IN (SELECT a.Id FROM Actors a WHERE NOT EXISTS (SELECT 1 FROM MovieActors ma WHERE ma.ActorId = a.Id))");
    var deletedActors = await db.Database.ExecuteSqlRawAsync(
        "DELETE FROM Actors WHERE NOT EXISTS (SELECT 1 FROM MovieActors ma WHERE ma.ActorId = Actors.Id)");

    var deletedFavoriteDirectors = await db.Database.ExecuteSqlRawAsync(
        "DELETE FROM FavoriteDirectors WHERE DirectorId IN (SELECT d.Id FROM Directors d WHERE NOT EXISTS (SELECT 1 FROM MovieDirectors md WHERE md.DirectorId = d.Id))");
    var deletedDirectorLikes = await db.Database.ExecuteSqlRawAsync(
        "DELETE FROM DirectorLikes WHERE DirectorId IN (SELECT d.Id FROM Directors d WHERE NOT EXISTS (SELECT 1 FROM MovieDirectors md WHERE md.DirectorId = d.Id))");
    var deletedDirectors = await db.Database.ExecuteSqlRawAsync(
        "DELETE FROM Directors WHERE NOT EXISTS (SELECT 1 FROM MovieDirectors md WHERE md.DirectorId = Directors.Id)");

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
    await db.Database.ExecuteSqlRawAsync("DELETE FROM CuratedListItems");
    await db.Database.ExecuteSqlRawAsync("DELETE FROM CuratedLists");
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
        "DELETE FROM CuratedListItems WHERE MovieId IN (SELECT Id FROM Movies WHERE TmdbId IS NULL)");
    var deletedFavorites = await db.Database.ExecuteSqlRawAsync(
        "DELETE FROM FavoriteMovies WHERE MovieId IN (SELECT Id FROM Movies WHERE TmdbId IS NULL)");
    var deletedWatchHistory = await db.Database.ExecuteSqlRawAsync(
        "DELETE FROM WatchHistory WHERE MovieId IN (SELECT Id FROM Movies WHERE TmdbId IS NULL)");

    // 2. Demo filmleri sil (Review/Like/WatchlistItem/MovieGenre/MovieActor cascade ile otomatik silinir)
    var deletedMovies = await db.Database.ExecuteSqlRawAsync("DELETE FROM Movies WHERE TmdbId IS NULL");

    // 3. Artık hiçbir filmde oynamayan yetim demo aktörlerini temizle
    //    (demo veride gerçek oyuncu isimleri kullanıldığı için TMDB import'u onları TmdbId'li
    //     olarak AYRICA oluşturmuş olabilir — bu adım o "sahte/eşleşmemiş" kopyaları temizler)
    var deletedFavoriteActors = await db.Database.ExecuteSqlRawAsync(
        "DELETE FROM FavoriteActors WHERE ActorId IN (SELECT a.Id FROM Actors a WHERE a.TmdbId IS NULL AND NOT EXISTS (SELECT 1 FROM MovieActors ma WHERE ma.ActorId = a.Id))");
    var deletedActorLikes = await db.Database.ExecuteSqlRawAsync(
        "DELETE FROM ActorLikes WHERE ActorId IN (SELECT a.Id FROM Actors a WHERE a.TmdbId IS NULL AND NOT EXISTS (SELECT 1 FROM MovieActors ma WHERE ma.ActorId = a.Id))");
    var deletedActors = await db.Database.ExecuteSqlRawAsync(
        "DELETE FROM Actors WHERE TmdbId IS NULL AND NOT EXISTS (SELECT 1 FROM MovieActors ma WHERE ma.ActorId = Actors.Id)");
    var deletedFavoriteDirectors = await db.Database.ExecuteSqlRawAsync(
    "DELETE FROM FavoriteDirectors WHERE DirectorId IN (SELECT d.Id FROM Directors d WHERE d.TmdbId IS NULL AND NOT EXISTS (SELECT 1 FROM MovieDirectors md WHERE md.DirectorId = d.Id))");
    var deletedDirectorLikes = await db.Database.ExecuteSqlRawAsync(
        "DELETE FROM DirectorLikes WHERE DirectorId IN (SELECT d.Id FROM Directors d WHERE d.TmdbId IS NULL AND NOT EXISTS (SELECT 1 FROM MovieDirectors md WHERE md.DirectorId = d.Id))");
    var deletedDirectors = await db.Database.ExecuteSqlRawAsync(
        "DELETE FROM Directors WHERE TmdbId IS NULL AND NOT EXISTS (SELECT 1 FROM MovieDirectors md WHERE md.DirectorId = Directors.Id)");

    Console.WriteLine($"Silinen film: {deletedMovies}");
    Console.WriteLine($"Silinen (yetim) aktör: {deletedActors}");
    Console.WriteLine($"Silinen (yetim) yönetmen: {deletedDirectors}");
    Console.WriteLine($"Temizlenen ilişkili kayıtlar: {deletedCuratedItems} küratör listesi öğesi, {deletedFavorites} favori film, {deletedWatchHistory} izleme geçmişi, {deletedFavoriteActors} favori aktör, {deletedActorLikes} aktör beğenisi.");
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
    Console.WriteLine("Filmlerin orijinal TMDB oy sayıları (SeedVoteCount) geri dolduruluyor...\n");

    List<(Guid Id, int TmdbId)> movies;
    Dictionary<Guid, int> localReviewCounts;

    await using (var db = new ApplicationDbContext(options))
    {
        movies = await db.Movies.Where(m => m.TmdbId != null)
            .Select(m => new ValueTuple<Guid, int>(m.Id, m.TmdbId!.Value)).ToListAsync();

        localReviewCounts = await db.Reviews.Where(r => !r.IsDeleted)
            .GroupBy(r => r.MovieId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.Key, g => g.Count);
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
            movie.RatingCount = detail.VoteCount + localReviewCounts.GetValueOrDefault(m.Id, 0);

            await db.SaveChangesAsync(cts.Token);
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
            if (existingTmdbIds.Contains(r.Id) || newIds.Contains(r.Id)) continue;
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
async Task ImportMoviesAsync(List<int> movieIds, Dictionary<int, Guid> genreMapping)
{
    int processed = 0, created = 0, updated = 0, failed = 0;

    foreach (var tmdbId in movieIds)
    {
        if (cts.IsCancellationRequested) break;
        processed++;

        try
        {
            var detail = await tmdb.GetMovieDetailAsync(tmdbId, cts.Token);
            if (detail is null) { failed++; continue; }

            await using var db = new ApplicationDbContext(dbOptions);

            var movie = await db.Movies
                .Include(m => m.MovieGenres)
                .Include(m => m.MovieActors)
                .Include(m => m.MovieDirectors)
                .FirstOrDefaultAsync(m => m.TmdbId == tmdbId, cts.Token);

            var isNew = movie is null;
            movie ??= new Movie { TmdbId = tmdbId };

            movie.Title = detail.Title;
            movie.OriginalTitle = string.IsNullOrWhiteSpace(detail.OriginalTitle) ? detail.Title : detail.OriginalTitle;
            movie.Overview = Truncate(detail.Overview, 4000);
            movie.ReleaseDate = ParseUtcDate(detail.ReleaseDate) ?? DateTime.UtcNow;
            movie.ReleaseYear = movie.ReleaseDate.Year;
            movie.RuntimeMinutes = detail.Runtime ?? 0;
            movie.PosterUrl = TmdbClient.BuildImageUrl(detail.PosterPath, "w500") ?? string.Empty;
            movie.BackdropUrl = TmdbClient.BuildImageUrl(detail.BackdropPath, "w1280") ?? string.Empty;
            movie.Country = detail.ProductionCountries.FirstOrDefault()?.Name ?? string.Empty;

            // NOT: AverageRating/RatingCount başlangıçta TMDB'nin izleyici puanından baseline olarak dolduruluyor.
            // TMDB'nin puan skalası 0-10 iken bizim skalamız (Letterboxd tarzı, yarım yıldız dahil) 0-5 olduğu
            // için burada TMDB puanı 2'ye bölünerek bizim skalamıza çevriliyor. Gerçek kullanıcılar UFMDb
            // üzerinden review yazdıkça bu değerler normal review-recalculation mantığıyla güncellenmeye devam eder.
            movie.AverageRating = Math.Round(detail.VoteAverage / 2.0, 2);
            movie.SeedVoteCount = detail.VoteCount;
            movie.RatingCount = detail.VoteCount;
            movie.ViewCount = detail.VoteCount;

            if (isNew) db.Movies.Add(movie);

            // ---- Türler (temizle + yeniden kur) ----
            movie.MovieGenres.Clear();
            foreach (var g in detail.Genres)
            {
                if (genreMapping.TryGetValue(g.Id, out var localGenreId))
                    movie.MovieGenres.Add(new MovieGenre { GenreId = localGenreId });
            }

            // ---- Oyuncu kadrosu (temizle + yeniden kur) ----
            movie.MovieActors.Clear();
            var castMembers = (detail.Credits?.Cast ?? new()).OrderBy(c => c.Order).Take(castLimit).ToList();
            foreach (var cast in castMembers)
            {
                var actor = await db.Actors.FirstOrDefaultAsync(a => a.TmdbId == cast.Id, cts.Token);
                if (actor is null)
                {
                    actor = new Actor
                    {
                        TmdbId = cast.Id,
                        FullName = cast.Name,
                        PhotoUrl = TmdbClient.BuildImageUrl(cast.ProfilePath, "w300") ?? string.Empty
                    };
                    db.Actors.Add(actor);
                    await db.SaveChangesAsync(cts.Token); // Id'yi hemen almak için
                }

                movie.MovieActors.Add(new MovieActor
                {
                    ActorId = actor.Id,
                    CharacterName = cast.Character ?? string.Empty,
                    Order = cast.Order
                });
            }

            // ---- Yönetmenler (temizle + yeniden kur) ----
            movie.MovieDirectors.Clear();
            var directingCrew = (detail.Credits?.Crew ?? new())
                .Where(c => c.Job == "Director")
                .ToList();

            var directorOrder = 0;
            foreach (var crewMember in directingCrew)
            {
                var director = await db.Directors.FirstOrDefaultAsync(d => d.TmdbId == crewMember.Id, cts.Token);
                if (director is null)
                {
                    director = new Director
                    {
                        TmdbId = crewMember.Id,
                        FullName = crewMember.Name,
                        PhotoUrl = TmdbClient.BuildImageUrl(crewMember.ProfilePath, "w300") ?? string.Empty
                    };
                    db.Directors.Add(director);
                    await db.SaveChangesAsync(cts.Token); // Id'yi hemen almak için
                }

                movie.MovieDirectors.Add(new MovieDirector
                {
                    DirectorId = director.Id,
                    Order = directorOrder++
                });
            }

            await db.SaveChangesAsync(cts.Token);

            if (isNew) created++; else updated++;

            if (processed % 20 == 0 || processed == movieIds.Count)
                Console.WriteLine($"[{processed}/{movieIds.Count}] işlendi — {created} yeni, {updated} güncellendi, {failed} başarısız. Son: {movie.Title} ({movie.ReleaseYear})");

            await Task.Delay(120, cts.Token); // TMDB rate limit'ine karşı temkinli bekleme
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

Console.WriteLine($"TMDB'den oy sayısına göre (yüksekten aza) yıl filtresi olmadan {targetMovieCount} benzersiz film ID'si toplanıyor (min. oy sayısı: {minVoteCount})...");
var movieIds = await DiscoverUniqueMovieIdsAsync(
    targetCount: targetMovieCount,
    existingTmdbIds: existingIds,
    sortBy: "vote_count.desc",
    minVoteCountFilter: minVoteCount);

Console.WriteLine($"Toplam {movieIds.Count} yeni film ID'si toplandı.\n");

if (movieIds.Count == 0)
{
    Console.WriteLine("İşlenecek yeni film yok, çıkılıyor.");
    return;
}

await ImportMoviesAsync(movieIds, genreMap);

static string Truncate(string value, int maxLength) =>
    string.IsNullOrEmpty(value) ? value : (value.Length <= maxLength ? value : value[..maxLength]);