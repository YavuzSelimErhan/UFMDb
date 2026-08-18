using UFMDb.Domain.Common;

namespace UFMDb.Domain.Entities;

public class Actor : BaseEntity
{
    public int? TmdbId { get; set; }
    public string FullName { get; set; } = default!;
    public DateTime? BirthDate { get; set; }
    public string Biography { get; set; } = string.Empty;
    public string PhotoUrl { get; set; } = string.Empty;
    public string Nationality { get; set; } = string.Empty;
    public int LikeCount { get; set; } = 0;

    public ICollection<MovieActor> MovieActors { get; set; } = new List<MovieActor>();
    public ICollection<ActorLike> ActorLikes { get; set; } = new List<ActorLike>();
}

/// <summary>Bir kullanıcının bir aktörü beğenmesi (film beğenisiyle aynı mantık).</summary>
public class ActorLike : BaseEntity
{
    public Guid ActorId { get; set; }
    public Actor Actor { get; set; } = default!;
    public Guid UserId { get; set; }
    public User User { get; set; } = default!;
}

/// <summary>Profildeki "Favori 4 oyuncu" özelliği için sıralı ilişki (FavoriteMovie ile aynı mantık).</summary>
public class FavoriteActor
{
    public Guid UserId { get; set; }
    public User User { get; set; } = default!;
    public Guid ActorId { get; set; }
    public Actor Actor { get; set; } = default!;
    public int Slot { get; set; } // 1..4 arası sabit slot
}
