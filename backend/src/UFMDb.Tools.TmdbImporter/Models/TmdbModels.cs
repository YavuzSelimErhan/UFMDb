using System.Text.Json.Serialization;

namespace UFMDb.Tools.TmdbImporter.Models;

// Not: JsonSerializerOptions'da JsonNamingPolicy.SnakeCaseLower kullanıldığı için
// property'ler PascalCase yazılsa da TMDB'nin snake_case alanlarıyla (release_date vb.) otomatik eşleşir.

public class TmdbGenreListResponse
{
    public List<TmdbGenre> Genres { get; set; } = new();
}

public class TmdbGenre
{
    public int Id { get; set; }
    public string Name { get; set; } = default!;
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
    public TmdbCredits? Credits { get; set; }
}

public class TmdbProductionCountry
{
    [JsonPropertyName("iso_3166_1")]
    public string Iso31661 { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
}

public class TmdbCredits
{
    public List<TmdbCastMember> Cast { get; set; } = new();
    public List<TmdbCrewMember> Crew { get; set; } = new();
}

public class TmdbCastMember
{
    public int Id { get; set; }
    public string Name { get; set; } = default!;
    public string? Character { get; set; }
    public int Order { get; set; }
    public string? ProfilePath { get; set; }
}

public class TmdbCrewMember
{
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