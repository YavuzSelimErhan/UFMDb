using UFMDb.Domain.Common;
namespace UFMDb.Domain.Entities;

public class Director : BaseEntity
{
    public int? TmdbId { get; set; }
    public string FullName { get; set; } = default!;
    public DateTime? BirthDate { get; set; }
    public string Biography { get; set; } = string.Empty;
    public string PhotoUrl { get; set; } = string.Empty;
    public string Nationality { get; set; } = string.Empty;
    public int LikeCount { get; set; } = 0;

    // Navigation
    public ICollection<MovieDirector> MovieDirectors { get; set; } = new List<MovieDirector>();
    public ICollection<DirectorLike> DirectorLikes { get; set; } = new List<DirectorLike>();
    public ICollection<FavoriteDirector> FavoriteDirectors { get; set; } = new List<FavoriteDirector>();
}

/// <summary>Movie-Director many-to-many join entity (bir filmin birden fazla yönetmeni olabilir)</summary>
public class MovieDirector
{
    public Guid MovieId { get; set; }
    public Movie Movie { get; set; } = default!;
    public Guid DirectorId { get; set; }
    public Director Director { get; set; } = default!;
    public int Order { get; set; } // kredi sırası
}

public class DirectorLike : BaseEntity
{
    public Guid DirectorId { get; set; }
    public Director Director { get; set; } = default!;
    public Guid UserId { get; set; }
    public User User { get; set; } = default!;
}

/// <summary>Profildeki "Favori 4 yönetmen" özelliği için sıralı ilişki</summary>
public class FavoriteDirector
{
    public Guid UserId { get; set; }
    public User User { get; set; } = default!;
    public Guid DirectorId { get; set; }
    public Director Director { get; set; } = default!;
    public int Slot { get; set; } // 1..4 arası sabit slot
}