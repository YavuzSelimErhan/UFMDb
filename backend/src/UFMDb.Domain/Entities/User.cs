using UFMDb.Domain.Common;
using UFMDb.Domain.Enums;

namespace UFMDb.Domain.Entities;

public class User : BaseEntity
{
    public string UserName { get; set; } = default!;
    public string Email { get; set; } = default!;
    public string PasswordHash { get; set; } = default!;
    public string PasswordSalt { get; set; } = default!;
    public UserRole Role { get; set; } = UserRole.User;
    public string? AvatarUrl { get; set; }
    public string PreferredLanguage { get; set; } = "tr"; // "tr" | "en"
    public string PreferredTheme { get; set; } = "dark";  // "dark" | "light"
    public bool IsActive { get; set; } = true;
    public string? FullName { get; set; }
    public string? Country { get; set; }
    public DateTime? BirthDate { get; set; }
    public Gender Gender { get; set; } = Gender.NotSpecified;
    public string? Biography { get; set; }

    // Navigation
    public ICollection<Review> Reviews { get; set; } = new List<Review>();
    public ICollection<ReviewLike> ReviewsLike { get; set; } = new List<ReviewLike>();
    public ICollection<Like> Likes { get; set; } = new List<Like>();
    public ICollection<WatchlistItem> WatchlistItems { get; set; } = new List<WatchlistItem>();
    public ICollection<FavoriteMovie> FavoriteMovies { get; set; } = new List<FavoriteMovie>();
    public ICollection<WatchHistory> WatchHistory { get; set; } = new List<WatchHistory>();
    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
    public ICollection<ActorLike> ActorLikes { get; set; } = new List<ActorLike>();
    public ICollection<DirectorLike> DirectorLikes { get; set; } = new List<DirectorLike>();
    public ICollection<FavoriteActor> FavoriteActors { get; set; } = new List<FavoriteActor>();
    public ICollection<FavoriteDirector> FavoriteDirectors { get; set; } = new List<FavoriteDirector>();
    public ICollection<MovieRating> MovieRatings { get; set; } = new List<MovieRating>();
    public ICollection<CuratedList> CreatedLists { get; set; } = new List<CuratedList>();
    public ICollection<CuratedListLike> CuratedListLikes { get; set; } = new List<CuratedListLike>();
}

public class RefreshToken : BaseEntity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = default!;
    public string Token { get; set; } = default!;
    public DateTime ExpiresAtUtc { get; set; }
    public bool IsRevoked { get; set; } = false;
}

/// <summary>Profil sayfasındaki "Favori 4 film" özelliği için sıralı ilişki</summary>
public class FavoriteMovie
{
    public Guid UserId { get; set; }
    public User User { get; set; } = default!;
    public Guid MovieId { get; set; }
    public Movie Movie { get; set; } = default!;
    public int Slot { get; set; } // 1..4 arası sabit slot
}

/// <summary>Profildeki "Son izlenenler" için</summary>
public class WatchHistory : BaseEntity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = default!;
    public Guid MovieId { get; set; }
    public Movie Movie { get; set; } = default!;
    public DateTime WatchedAtUtc { get; set; } = DateTime.UtcNow;
    public decimal? Rating { get; set; } // eklendi — bu SPESİFİK seansta verilen puan
}
