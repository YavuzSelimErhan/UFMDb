using System.Text.Json.Serialization;

namespace UFMDb.Tools.TmdbImporter.Models;

// Not: JsonSerializerOptions'da JsonNamingPolicy.SnakeCaseLower kullanıldığı için
// property'ler PascalCase yazılsa da TMDB'nin snake_case alanlarıyla (release_date vb.) otomatik eşleşir.
// iso_3166_1 / iso_639_1 gibi rakam içeren alanlar için [JsonPropertyName] açıkça verilir.
//
// Detay isteği: append_to_response=credits,keywords,images,release_dates,videos,translations

public class TmdbGenreListResponse
{
    public List<TmdbGenre> Genres { get; set; } = new();
}

public class TmdbGenre
{
    public int Id { get; set; }
    public string Name { get; set; } = default!;
}

public class TmdbCountry
{
    [JsonPropertyName("iso_3166_1")]
    public string Iso3166_1 { get; set; } = default!;
    public string EnglishName { get; set; } = default!;
    public string NativeName { get; set; } = default!;
}

public class TmdbDiscoverResponse
{
    public int Page { get; set; }
    public List<TmdbMovieSummary> Results { get; set; } = new();
    public int TotalPages { get; set; }
    public int TotalResults { get; set; }
}

public class TmdbMovieSummary
{
    public int Id { get; set; }
    public string Title { get; set; } = default!;
    public string? ReleaseDate { get; set; }
    public double Popularity { get; set; }
    public int VoteCount { get; set; }
}

public class TmdbMovieDetail
{
    public int Id { get; set; }
    public string Title { get; set; } = default!;
    public string OriginalTitle { get; set; } = string.Empty;
    public string Overview { get; set; } = string.Empty;
    public string? ReleaseDate { get; set; }
    public int? Runtime { get; set; }
    public string? PosterPath { get; set; }
    public string? BackdropPath { get; set; }
    public double VoteAverage { get; set; }
    public int VoteCount { get; set; }
    public List<TmdbGenre> Genres { get; set; } = new();
    public List<TmdbProductionCountry> ProductionCountries { get; set; } = new();
    public string? ImdbId { get; set; }
    public string? OriginalLanguage { get; set; }
    public string? Tagline { get; set; }
    public string? Homepage { get; set; }
    public long Budget { get; set; }
    public long Revenue { get; set; }
    public string? Status { get; set; }
    public double Popularity { get; set; }
    public TmdbCollectionRef? BelongsToCollection { get; set; }
    public List<TmdbProductionCompany> ProductionCompanies { get; set; } = new();

    // append_to_response ile gelen alt kaynaklar
    public TmdbCredits? Credits { get; set; }
    public TmdbKeywordList? Keywords { get; set; }
    public TmdbImageList? Images { get; set; }
    public TmdbReleaseDatesResponse? ReleaseDates { get; set; }
    public TmdbVideoList? Videos { get; set; }
    public TmdbTranslationList? Translations { get; set; }
}

public class TmdbProductionCountry
{
    [JsonPropertyName("iso_3166_1")]
    public string Iso31661 { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
}

public class TmdbCredits
{
    public List<TmdbCastMember>? Cast { get; set; }
    public List<TmdbCrewMember>? Crew { get; set; }
}

public class TmdbCastMember
{
    public string CreditId { get; set; } = string.Empty;
    public int Id { get; set; }
    public string Name { get; set; } = default!;
    public string? Character { get; set; }
    public int Order { get; set; }
    public string? ProfilePath { get; set; }
}

public class TmdbCrewMember
{
    public string CreditId { get; set; } = string.Empty;
    public int Id { get; set; }
    public string Name { get; set; } = default!;
    public string? Job { get; set; }
    public string? Department { get; set; }
    public string? ProfilePath { get; set; }
}

public class TmdbPersonDetail
{
    public int Id { get; set; }
    public string Name { get; set; } = default!;
    public string? Biography { get; set; }
    public string? Birthday { get; set; }
    public string? PlaceOfBirth { get; set; }
    public string? ProfilePath { get; set; }
}

public class TmdbCollectionRef
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? PosterPath { get; set; }
    public string? BackdropPath { get; set; }
}

public class TmdbProductionCompany
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? LogoPath { get; set; }
    public string? OriginCountry { get; set; }
}

public class TmdbKeywordList { public List<TmdbKeyword> Keywords { get; set; } = new(); }
public class TmdbKeyword { public int Id { get; set; } public string Name { get; set; } = string.Empty; }

public class TmdbImageList
{
    public List<TmdbImage> Posters { get; set; } = new();
    public List<TmdbImage> Backdrops { get; set; } = new();
    public List<TmdbImage> Logos { get; set; } = new();
}

public class TmdbImage
{
    public string FilePath { get; set; } = string.Empty;
    public int Width { get; set; }
    public int Height { get; set; }
    public double VoteAverage { get; set; }
    [JsonPropertyName("iso_639_1")] public string? Iso639_1 { get; set; }
}

public class TmdbReleaseDatesResponse { public List<TmdbReleaseDateCountry> Results { get; set; } = new(); }

public class TmdbReleaseDateCountry
{
    [JsonPropertyName("iso_3166_1")] public string Iso3166_1 { get; set; } = string.Empty;
    public List<TmdbReleaseDateEntry> ReleaseDates { get; set; } = new();
}

public class TmdbReleaseDateEntry
{
    public string? Certification { get; set; }
    /// <summary>1 Premiere, 2 Theatrical (limited), 3 Theatrical, 4 Digital, 5 Physical, 6 TV.</summary>
    public int Type { get; set; }
    public string? ReleaseDate { get; set; }
}

// --- Videolar (MovieVideo + TrailerKey için) ---
public class TmdbVideoList { public List<TmdbVideo> Results { get; set; } = new(); }

public class TmdbVideo
{
    public string Id { get; set; } = string.Empty;
    public string Key { get; set; } = string.Empty;
    public string Site { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public bool Official { get; set; }
    public DateTime? PublishedAt { get; set; }
    [JsonPropertyName("iso_639_1")] public string? Iso639_1 { get; set; }
    [JsonPropertyName("iso_3166_1")] public string? Iso3166_1 { get; set; }
}

// --- Çeviriler (TitleTr / OverviewTr / TaglineTr için, iso_639_1 = "tr") ---
public class TmdbTranslationList { public List<TmdbTranslation> Translations { get; set; } = new(); }

public class TmdbTranslation
{
    [JsonPropertyName("iso_639_1")] public string Iso639_1 { get; set; } = string.Empty;
    [JsonPropertyName("iso_3166_1")] public string Iso3166_1 { get; set; } = string.Empty;
    public string? Name { get; set; }
    public string? EnglishName { get; set; }
    public TmdbTranslationData? Data { get; set; }
}

public class TmdbTranslationData
{
    public string? Title { get; set; }
    public string? Overview { get; set; }
    public string? Tagline { get; set; }
    public string? Homepage { get; set; }
    public int? Runtime { get; set; }
}