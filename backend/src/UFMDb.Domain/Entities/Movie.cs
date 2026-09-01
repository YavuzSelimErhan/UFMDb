using UFMDb.Domain.Common;
using UFMDb.Domain.Enums;

namespace UFMDb.Domain.Entities;

public class Movie : BaseEntity
{
    /// <summary>TMDB'deki karşılık gelen film ID'si. Senkronizasyon/upsert anahtarı olarak kullanılır;
    /// bizim kendi Guid Id'imiz PK ve tüm ilişkiler (Review, Like, Watchlist vb.) buna bağlıdır,
    /// bu yüzden TMDB verisini tekrar çekip güncellesek bile kullanıcı verisi asla bozulmaz.</summary>
    public int? TmdbId { get; set; }
    public string Title { get; set; } = default!;
    public string OriginalTitle { get; set; } = default!;
    public string Overview { get; set; } = string.Empty;
    public int ReleaseYear { get; set; }
    public DateTime ReleaseDate { get; set; }
    public int RuntimeMinutes { get; set; }
    public string PosterUrl { get; set; } = string.Empty;
    public string BackdropUrl { get; set; } = string.Empty;
    public string Country { get; set; } = string.Empty;

    // Denormalize edilmiş, performans için tutulan alanlar (her review sonrası recalculate edilir)
    public double AverageRating { get; set; } = 0;
    public int RatingCount { get; set; } = 0;
    public int LikeCount { get; set; } = 0;
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

    // Navigation
    public ICollection<MovieGenre> MovieGenres { get; set; } = new List<MovieGenre>();
    public ICollection<MovieActor> MovieActors { get; set; } = new List<MovieActor>();
    public ICollection<MovieDirector> MovieDirectors { get; set; } = new List<MovieDirector>();
    public ICollection<Review> Reviews { get; set; } = new List<Review>();
    public ICollection<Like> Likes { get; set; } = new List<Like>();
    public ICollection<WatchlistItem> WatchlistItems { get; set; } = new List<WatchlistItem>();
    public ICollection<MovieRating> MovieRatings { get; set; } = new List<MovieRating>();
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
