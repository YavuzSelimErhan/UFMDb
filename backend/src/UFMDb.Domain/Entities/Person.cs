using UFMDb.Domain.Common;

namespace UFMDb.Domain.Entities;

public class Person : BaseEntity
{
    public int? TmdbId { get; set; }

    // Geçiþ dönemi: eski Actor/Director kayýtlarýyla eþleþtirme (eski linkler, like/favori taþýma).
    // Kiþi hem aktör hem yönetmense ikisi de dolu olur. Geçiþ bitince kaldýrýlabilir.
    public Guid? LegacyActorId { get; set; }
    public Guid? LegacyDirectorId { get; set; }

    public string FullName { get; set; } = string.Empty;
    public DateTime? BirthDate { get; set; }
    public string Biography { get; set; } = string.Empty;
    public string PhotoUrl { get; set; } = string.Empty;
    public string Nationality { get; set; } = string.Empty;
    public int LikeCount { get; set; } = 0;

    public ICollection<MovieCredit> Credits { get; set; } = new List<MovieCredit>();
    public ICollection<PersonLike> PersonLikes { get; set; } = new List<PersonLike>();
    public ICollection<FavoritePerson> FavoritePeople { get; set; } = new List<FavoritePerson>();
}

/// <summary>Bir kullanýcýnýn bir kiþiyi (oyuncu/yönetmen fark etmez) beðenmesi.</summary>
public class PersonLike : BaseEntity
{
    public Guid PersonId { get; set; }
    public Person Person { get; set; } = default!;
    public Guid UserId { get; set; }
    public User User { get; set; } = default!;
}

public enum FavoritePersonRole { Actor, Director }

/// <summary>Profildeki "Favori 4 oyuncu" ve "Favori 4 yönetmen" listeleri; Role hangi liste olduðunu belirtir.</summary>
public class FavoritePerson
{
    public Guid UserId { get; set; }
    public User User { get; set; } = default!;
    public FavoritePersonRole Role { get; set; }
    public Guid PersonId { get; set; }
    public Person Person { get; set; } = default!;
    public int Slot { get; set; } // 1..4 arasý sabit slot (her Role için ayrý)
}