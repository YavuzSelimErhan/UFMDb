using UFMDb.Domain.Common;
using UFMDb.Domain.Enums;

namespace UFMDb.Domain.Entities
{
    /// <summary>Ana sayfa küratör seçkileri (ör. "Yönetmenin Seçtikleri")</summary>
    /// <summary>Film listesi — hem resmi (admin/site) koleksiyonları hem kullanıcı listelerini kapsar</summary>
    public class CuratedList : BaseEntity
    {
        // İçerik (Tr/En)
        public string Title { get; set; } = default!;
        public string TitleTr { get; set; } = default!;
        public string Description { get; set; } = string.Empty;
        public string DescriptionTr { get; set; } = string.Empty;
        public string Slug { get; set; } = default!;
        public string CoverImageUrl { get; set; } = string.Empty;

        // Davranış
        public bool IsRanked { get; set; }                 // true: sıralı (numaralı), false: sırasız
        public ListVisibility Visibility { get; set; } = ListVisibility.Public;
        public ListStatus Status { get; set; } = ListStatus.Published;
        public int DisplayOrder { get; set; }              // sadece resmi listelerin vitrin sırası

        // Sahiplik
        /// <summary>true: sitenin resmi koleksiyonu (sadece Admin). false: kullanıcı listesi.</summary>
        public bool IsOfficial { get; set; } = false;
        public Guid CreatedByUserId { get; set; }
        public User CreatedByUser { get; set; } = default!;

        // Sayaçlar (denormalize)
        public int LikeCount { get; set; }
        public int ItemCount { get; set; }
        public int ViewCount { get; set; }

        public DateTime? PublishedAt { get; set; }

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

        public string? Note { get; set; }
        public string? NoteTr { get; set; }
        public DateTime AddedAt { get; set; } = DateTime.UtcNow;
    }
}
