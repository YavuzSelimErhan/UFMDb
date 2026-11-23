using UFMDb.Domain.Enums;

namespace UFMDb.Application.DTOs;

public record MovieListItemDto(
    Guid Id, string Title, int ReleaseYear, string PosterUrl,
    decimal AverageRating, int RatingCount, List<string> Genres,
    string BackdropUrl, string Overview,
    bool IsInWatchlistByCurrentUser, bool IsLikedByCurrentUser, bool IsWatchedByCurrentUser,
    DateTime ReleaseDate,
    ReactionType? CurrentUserReaction = null
);

public record MovieDirectorDto(Guid Id, string FullName, string PhotoUrl, Guid? PersonId = null);

public record MyReviewDto(string Content, bool ContainsSpoiler);

public record MovieVideoDto(string Key, string Site, string Type, string Name, string Language, bool IsOfficial);
/// <summary>FilePath TMDB yoludur ("/abc.jpg"); boyutu frontend seçer: https://image.tmdb.org/t/p/{size}{FilePath}</summary>
public record MovieImageDto(string Type, string FilePath, string Language, int Width, int Height);
public record KeywordDto(Guid Id, string Name);
public record ProductionCompanyDto(Guid Id, string Name, string LogoPath, string OriginCountry);
public record MovieCountryDto(string IsoCode, string Name);
public record CollectionMovieDto(Guid Id, string Title, int ReleaseYear, string PosterUrl);
public record MovieCollectionDto(Guid Id, string Name, string PosterUrl, string BackdropUrl, List<CollectionMovieDto> Movies);

public record MovieCrewDto(Guid PersonId, string FullName, string Job, string PhotoUrl, Guid? DirectorId);

public record MovieDetailDto(
    Guid Id, string Title, string OriginalTitle, string Overview, int ReleaseYear, DateTime ReleaseDate,
    int RuntimeMinutes, string PosterUrl, string BackdropUrl, List<MovieDirectorDto> Directors, string Country,
    double AverageRating, int RatingCount, int LikeCount, List<string> Genres, List<Guid> GenreIds,
    List<MovieCastDto> Cast, bool IsLikedByCurrentUser, bool IsInWatchlistByCurrentUser, bool IsWatchedByCurrentUser,
    decimal? MyRating, MyReviewDto? MyReview,
    int DislikeCount = 0, ReactionType? CurrentUserReaction = null,
    string Tagline = "", string TrailerKey = "", string Certification = "", string CertificationCountry = "",
    string? ImdbId = null, string Homepage = "", string OriginalLanguage = "",
    long Budget = 0, long Revenue = 0, string TmdbStatus = "",
    List<MovieCountryDto>? Countries = null,
    List<KeywordDto>? Keywords = null,
    List<ProductionCompanyDto>? Companies = null,
    List<MovieVideoDto>? Videos = null,
    List<MovieImageDto>? Images = null,
    MovieCollectionDto? Collection = null,
    List<MovieCrewDto>? Crew = null
);

public record MovieCastDto(Guid ActorId, string FullName, string PhotoUrl, string CharacterName, int Order, Guid? PersonId = null);
public record DirectorListItemDto(Guid Id, string FullName, string PhotoUrl, string Nationality);


public record PagedResult<T>(List<T> Items, int TotalCount, int Page, int PageSize)
{
    public int TotalPages => (int)Math.Ceiling(TotalCount / (double)PageSize);
}

public record MovieSearchQueryDto(
    string? Title,
    string? Genre,
    string? Country,
    int? Year,
    string? ActorName,
    double? MinRating,
    int Page = 1,
    int PageSize = 20,
    string? SortBy = "title",
    string? SortDirection = "asc",
    int? YearFrom = null,
    int? YearTo = null,
    string? DirectorName = null,
    DateTime? ReleaseDateFrom = null,
    DateTime? ReleaseDateTo = null,
    string? Keyword = null,
    Guid? CollectionId = null
);