using UFMDb.Domain.Common;
using UFMDb.Domain.Enums;

namespace UFMDb.Domain.Entities;

/// <summary>Yorum + puan birlikte tutulur (Letterboxd tarzı)</summary>
public class Review : BaseEntity
{
    public Guid MovieId { get; set; }
    public Movie Movie { get; set; } = default!;
    public Guid UserId { get; set; }
    public User User { get; set; } = default!;
    public string Content { get; set; } = string.Empty;
    public bool ContainsSpoiler { get; set; } = false;
    public int HelpfulCount { get; set; } = 0;
}

public class Like : BaseEntity
{
    public Guid MovieId { get; set; }
    public Movie Movie { get; set; } = default!;
    public Guid UserId { get; set; }
    public User User { get; set; } = default!;
}

public class WatchlistItem : BaseEntity
{
    public Guid MovieId { get; set; }
    public Movie Movie { get; set; } = default!;
    public Guid UserId { get; set; }
    public User User { get; set; } = default!;
    public WatchStatus Status { get; set; } = WatchStatus.PlanToWatch;
}

/// <summary>Ana sayfa küratör seçkileri (ör. "Yönetmenin Seçtikleri")</summary>
/// <summary>Film listesi — hem resmi (admin/site) koleksiyonları hem kullanıcı listelerini kapsar</summary>
public class CuratedList : BaseEntity
{
    public string Title { get; set; } = default!;
    public string TitleTr { get; set; } = default!;
    public string Description { get; set; } = string.Empty;
    public string CoverImageUrl { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }

    // ---- Yeni alanlar ----
    /// <summary>true: sitenin resmi koleksiyonu (sadece Admin oluşturabilir). false: bir kullanıcının kendi listesi.</summary>
    public bool IsOfficial { get; set; } = true;
    public Guid CreatedByUserId { get; set; }
    public User CreatedByUser { get; set; } = default!;
    public int LikeCount { get; set; } = 0;

    public ICollection<CuratedListItem> Items { get; set; } = new List<CuratedListItem>();
    public ICollection<CuratedListLike> Likes { get; set; } = new List<CuratedListLike>();
}

public class CuratedListLike : BaseEntity
{
    public Guid CuratedListId { get; set; }
    public CuratedList CuratedList { get; set; } = default!;
    public Guid UserId { get; set; }
    public User User { get; set; } = default!;
}

public class CuratedListItem
{
    public Guid CuratedListId { get; set; }
    public CuratedList CuratedList { get; set; } = default!;
    public Guid MovieId { get; set; }
    public Movie Movie { get; set; } = default!;
    public int Order { get; set; }
}
