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
public class CuratedList : BaseEntity
{
    public string Title { get; set; } = default!;
    public string TitleTr { get; set; } = default!;
    public string Description { get; set; } = string.Empty;
    public string CoverImageUrl { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
    public ICollection<CuratedListItem> Items { get; set; } = new List<CuratedListItem>();
}

public class CuratedListItem
{
    public Guid CuratedListId { get; set; }
    public CuratedList CuratedList { get; set; } = default!;
    public Guid MovieId { get; set; }
    public Movie Movie { get; set; } = default!;
    public int Order { get; set; }
}
