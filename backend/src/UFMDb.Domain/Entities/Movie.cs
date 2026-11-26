using UFMDb.Domain.Common;
using UFMDb.Domain.Enums;

namespace UFMDb.Domain.Entities;

public class Movie : BaseEntity
{
    /// <summary>TMDB'deki karşılık gelen film ID'si. Senkronizasyon/upsert anahtarı olarak kullanılır;
    /// bizim kendi Guid Id'imiz PK ve tüm ilişkiler (Review, Like, Watchlist vb.) buna bağlıdır,
    /// bu yüzden TMDB verisini tekrar çekip güncellesek bile kullanıcı verisi asla bozulmaz.</summary>
    public int? TmdbId { get; set; }

    /// <summary>IMDb ID'si (örn. "tt0361748"). TMDB'de yoksa null; doluysa tekil.</summary>
    public string? ImdbId { get; set; }

    // --- Lokalize alanlar: projedeki diğer entity'lerle (Genre.NameTr, CuratedList.TitleTr) aynı
    // "X / XTr" deseni. X = İngilizce, XTr = Türkçe. Tr boşsa okuma tarafında İngilizce'ye düşülür.
    public string Title { get; set; } = default!;
    public string TitleTr { get; set; } = string.Empty;
    public string OriginalTitle { get; set; } = default!;
    public string Overview { get; set; } = string.Empty;
    public string OverviewTr { get; set; } = string.Empty;
    public string Tagline { get; set; } = string.Empty;
    public string TaglineTr { get; set; } = string.Empty;

    /// <summary>Orijinal dil, ISO 639-1 (örn. "en", "ko", "tr").</summary>
    public string OriginalLanguage { get; set; } = string.Empty;

    public int ReleaseYear { get; set; }
    public DateTime ReleaseDate { get; set; }
    public int RuntimeMinutes { get; set; }
    public string PosterUrl { get; set; } = string.Empty;
    public string BackdropUrl { get; set; } = string.Empty;
    public string Country { get; set; } = string.Empty;
    public string Homepage { get; set; } = string.Empty;

    /// <summary>YouTube fragman anahtarı (örn. "dQw4w9WgXcQ"); URL değil, yalnızca key.</summary>
    public string TrailerKey { get; set; } = string.Empty;

    /// <summary>Bütçe ve hasılat, USD. TMDB bilinmeyenler için 0 döner; 0 = "bilinmiyor" anlamına gelir.</summary>
    public long Budget { get; set; } = 0;
    public long Revenue { get; set; } = 0;

    /// <summary>TMDB'nin film durumu metni ("Released", "Post Production", "In Production" vb.).
    /// LifecycleStatus'tan farklıdır: o bizim senkronizasyon yaşam döngümüz, bu TMDB'nin ham verisi.</summary>
    public string TmdbStatus { get; set; } = string.Empty;

    /// <summary>TMDB popülerlik skoru. Günlük değişir, sync ile güncellenir; kendi trend hesabımızın yerine geçmez.</summary>
    public double TmdbPopularity { get; set; } = 0;

    // Denormalize edilmiş, performans için tutulan alanlar (her review sonrası recalculate edilir)
    public double AverageRating { get; set; } = 0;
    public int RatingCount { get; set; } = 0;
    public int LikeCount { get; set; } = 0;
    public int DislikeCount { get; set; } = 0;
    public int ViewCount { get; set; } = 0; // trend hesaplamada kullanılır

    /// <summary>MovieDB'den gelen orijinal puan. Kullanıcı review'ları geldikçe AverageRating
    /// bundan uzaklaşıp gerçek ortalamaya yaklaşır (ağırlıklı formül), ama bu alan hiç değişmez —
    /// formülün "çapa" noktasıdır ve az oylu filmlerde güvenilirliği korur.</summary>
    public double SeedRating { get; set; } = 0;
    public int SeedVoteCount { get; set; } = 0;

    /// <summary>Filmin TMDB senkronizasyon yaşam döngüsü. Yeni film importunda ReleaseDate'e göre
    /// otomatik atanır; Upcoming -> NewlyReleased geçişi refresh-released job'ı, 
    /// NewlyReleased -> Stable geçişi refresh-post-release job'ı tarafından yapılır.</summary>
    public MovieLifecycleStatus LifecycleStatus { get; set; } = MovieLifecycleStatus.Stable;

    /// <summary>Bu filmin TMDB'den en son ne zaman (herhangi bir sebeple) çekildiği.</summary>
    public DateTime? LastTmdbSyncAt { get; set; }

    /// <summary>Vizyon sonrası "ikinci tur" senkronizasyonun ne zaman yapıldığı. Null ise henüz yapılmadı.</summary>
    public DateTime? PostReleaseSyncedAt { get; set; }

    /// <summary>Yaş sınırı (örn. "PG-13", "13+"). Önce TR, yoksa US; hangisi olduğu CertificationCountry'de.</summary>
    public string Certification { get; set; } = string.Empty;
    public string CertificationCountry { get; set; } = string.Empty;

    public Guid? CollectionId { get; set; }
    public MovieCollection? Collection { get; set; }

    public ICollection<MovieVideo> Videos { get; set; } = new List<MovieVideo>(); // zaten eklediysen tekrar ekleme
    public ICollection<MovieImage> Images { get; set; } = new List<MovieImage>();
    public ICollection<MovieKeyword> MovieKeywords { get; set; } = new List<MovieKeyword>();
    public ICollection<MovieProductionCompany> MovieProductionCompanies { get; set; } = new List<MovieProductionCompany>();
    public ICollection<MovieCountry> MovieCountries { get; set; } = new List<MovieCountry>();

    // Navigation
    public ICollection<MovieGenre> MovieGenres { get; set; } = new List<MovieGenre>();

    /// <summary>Yeni kredi sistemi (cast + crew tek tabloda). Geçiş bitince MovieActors/MovieDirectors kaldırılacak.</summary>
    public ICollection<MovieCredit> Credits { get; set; } = new List<MovieCredit>();

    public ICollection<MovieActor> MovieActors { get; set; } = new List<MovieActor>();
    public ICollection<MovieDirector> MovieDirectors { get; set; } = new List<MovieDirector>();
    public ICollection<Review> Reviews { get; set; } = new List<Review>();
    public ICollection<Like> Likes { get; set; } = new List<Like>();
    public ICollection<WatchlistItem> WatchlistItems { get; set; } = new List<WatchlistItem>();
    public ICollection<MovieRating> MovieRatings { get; set; } = new List<MovieRating>();
}

public class MovieVideo : BaseEntity
{
    public Guid MovieId { get; set; }
    public Movie Movie { get; set; } = default!;

    /// <summary>YouTube anahtarı (URL değil).</summary>
    public string Key { get; set; } = string.Empty;
    public string Site { get; set; } = "YouTube";
    /// <summary>"Trailer", "Teaser" vb. (TMDB ham değeri)</summary>
    public string Type { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    /// <summary>ISO 639-1 (ör. "en", "tr"). Dil belirtilmemişse boş.</summary>
    public string Language { get; set; } = string.Empty;
    public bool IsOfficial { get; set; }
    public DateTime? PublishedAtUtc { get; set; }
}

public class MovieImage : BaseEntity
{
    public Guid MovieId { get; set; }
    public Movie Movie { get; set; } = default!;

    /// <summary>"Poster", "Backdrop" veya "Logo".</summary>
    public string Type { get; set; } = string.Empty;
    /// <summary>TMDB dosya yolu (örn. "/abc.jpg"). Tam URL değil; boyutu frontend seçer.</summary>
    public string FilePath { get; set; } = string.Empty;
    /// <summary>ISO 639-1; boşsa metinsiz görsel.</summary>
    public string Language { get; set; } = string.Empty;
    public int Width { get; set; }
    public int Height { get; set; }
    public double VoteAverage { get; set; }
}

public class Keyword : BaseEntity
{
    public int TmdbId { get; set; }
    public string Name { get; set; } = string.Empty;
    public ICollection<MovieKeyword> MovieKeywords { get; set; } = new List<MovieKeyword>();
}

public class MovieKeyword : BaseEntity
{
    public Guid MovieId { get; set; }
    public Movie Movie { get; set; } = default!;
    public Guid KeywordId { get; set; }
    public Keyword Keyword { get; set; } = default!;
}

public class ProductionCompany : BaseEntity
{
    public int TmdbId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string LogoPath { get; set; } = string.Empty;
    public string OriginCountry { get; set; } = string.Empty;
    public ICollection<MovieProductionCompany> MovieProductionCompanies { get; set; } = new List<MovieProductionCompany>();
}

public class MovieProductionCompany : BaseEntity
{
    public Guid MovieId { get; set; }
    public Movie Movie { get; set; } = default!;
    public Guid ProductionCompanyId { get; set; }
    public ProductionCompany ProductionCompany { get; set; } = default!;
}

/// <summary>TMDB "belongs_to_collection" (ör. bir üçleme/seri).</summary>
public class MovieCollection : BaseEntity
{
    public int TmdbId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string PosterUrl { get; set; } = string.Empty;
    public string BackdropUrl { get; set; } = string.Empty;
    public ICollection<Movie> Movies { get; set; } = new List<Movie>();
}

public class MovieCountry : BaseEntity
{
    public Guid MovieId { get; set; }
    public Movie Movie { get; set; } = default!;
    public Guid CountryId { get; set; }
    public Country Country { get; set; } = default!;
    public int Order { get; set; }
}

public class Genre : BaseEntity
{
    public int? TmdbId { get; set; }
    public string Name { get; set; } = default!;
    public string NameTr { get; set; } = default!; // i18n için Türkçe karşılık
    public ICollection<MovieGenre> MovieGenres { get; set; } = new List<MovieGenre>();
}

public class Country : BaseEntity
{
    public string IsoCode { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string NameTr { get; set; } = default!;
}

/// <summary>Movie-Genre many-to-many join entity</summary>
public class MovieGenre
{
    public Guid MovieId { get; set; }
    public Movie Movie { get; set; } = default!;
    public Guid GenreId { get; set; }
    public Genre Genre { get; set; } = default!;
}

/// <summary>Movie-Actor many-to-many join entity (rol bilgisi taşır)</summary>
public class MovieActor
{
    public Guid MovieId { get; set; }
    public Movie Movie { get; set; } = default!;
    public Guid ActorId { get; set; }
    public Actor Actor { get; set; } = default!;
    public string CharacterName { get; set; } = string.Empty;
    public int Order { get; set; } // kredi sırası (afişte oyuncu sırası)
}