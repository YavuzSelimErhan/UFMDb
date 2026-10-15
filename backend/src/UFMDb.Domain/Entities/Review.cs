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
    public int LikeCount { get; set; } = 0;
    public ICollection<ReviewLike> Likes { get; set; } = new List<ReviewLike>();
}

public class ReviewLike : BaseEntity
{
    public Guid ReviewId { get; set; }
    public Review Review { get; set; } = default!;
    public Guid UserId { get; set; }
    public User User { get; set; } = default!;
}

public class Like : BaseEntity
{
    public Guid MovieId { get; set; }
    public Movie Movie { get; set; } = default!;
    public Guid UserId { get; set; }
    public User User { get; set; } = default!;
    public ReactionType Reaction { get; set; } = ReactionType.Like;
}

public class WatchlistItem : BaseEntity
{
    public Guid MovieId { get; set; }
    public Movie Movie { get; set; } = default!;
    public Guid UserId { get; set; }
    public User User { get; set; } = default!;
    public WatchStatus Status { get; set; } = WatchStatus.PlanToWatch;
}
