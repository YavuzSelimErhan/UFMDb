namespace UFMDb.Application.DTOs;

public record MovieListItemDto(
    Guid Id,
    string Title,
    int ReleaseYear,
    string PosterUrl,
    double AverageRating,
    int RatingCount,
    List<string> Genres,
    string BackdropUrl,
    string Overview,
    bool IsInWatchlistByCurrentUser = false,
    bool IsLikedByCurrentUser = false
);

public record MovieDirectorDto(Guid Id, string FullName, string PhotoUrl);

public record MyReviewDto(string Content, bool ContainsSpoiler);

public record MovieDetailDto(
    Guid Id, string Title, string OriginalTitle, string Overview, int ReleaseYear, DateTime ReleaseDate,
    int RuntimeMinutes, string PosterUrl, string BackdropUrl, List<MovieDirectorDto> Directors, string Country,
    double AverageRating, int RatingCount, int LikeCount, List<string> Genres, List<Guid> GenreIds,
    List<MovieCastDto> Cast, bool IsLikedByCurrentUser, bool IsInWatchlistByCurrentUser, bool IsWatchedByCurrentUser,
    decimal? MyRating, MyReviewDto? MyReview
);

public record MovieCastDto(Guid ActorId, string FullName, string PhotoUrl, string CharacterName, int Order);
public record DirectorListItemDto(Guid Id, string FullName, string PhotoUrl, string Nationality);


public record PagedResult<T>(List<T> Items, int TotalCount, int Page, int PageSize)
{
    public int TotalPages => (int)Math.Ceiling(TotalCount / (double)PageSize);
}

public record MovieSearchQueryDto(
    string? Title,
    string? Genre,
    int? Year,
    string? ActorName,
    double? MinRating,
    int Page = 1,
    int PageSize = 20,
    string? SortBy = "title", // title | rating | year
    string? SortDirection = "asc", // asc | desc
    int? YearFrom = null,
    int? YearTo = null,
    string? DirectorName = null
);
