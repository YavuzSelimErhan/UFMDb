namespace UFMDb.Domain.Enums;

public enum UserRole
{
    User = 0,
    Admin = 1
}

public enum WatchStatus
{
    PlanToWatch = 0,
    Watching = 1,
    Watched = 2
}

public enum CuratedListType
{
    Popular,
    TopRated,
    Trending,
    EditorsPick
}

public enum Gender
{
    NotSpecified = 0,
    Male = 1,
    Female = 2
}

public enum MovieLifecycleStatus
{
    /// <summary>Vizyon tarihi henüz gelmedi.</summary>
    Upcoming = 0,
    /// <summary>Vizyona girdi ama vizyon-sonrası ikinci senkronizasyon henüz yapılmadı (veriler henüz "olgunlaşmamış" olabilir).</summary>
    NewlyReleased = 1,
    /// <summary>Vizyon üzerinden yeterli süre geçti, veriler oturmuş kabul edilir.</summary>
    Stable = 2
}

/// <summary>
/// Bildirim turu. Yeni turler hep SONA eklenmeli: degerler (int) veritabaninda saklaniyor olabilir.
/// </summary>
public enum NotificationType
{
    Follow = 0,
    /// <summary>Birisi yorumunu begendi. EntityId = review id.</summary>
    ReviewLike = 1,
    /// <summary>Birisi listeni begendi. EntityId = liste id.</summary>
    ListLike = 2,
    /// <summary>Takip ettigin biri yeni liste olusturdu. EntityId = liste id.</summary>
    ListCreated = 3
}

/// <summary>Bir filme verilen tepki. Mevcut tüm beğeni kayıtları Like (0) olarak kalır.</summary>
public enum ReactionType
{
    Like = 0,     // Beğendi
    Dislike = 1   // Beğenmedi (kırık kalp: "iyi film ama bana göre değil")
}

public enum ListVisibility { Public = 0, Unlisted = 1, Private = 2 }
public enum ListStatus { Published = 0, Draft = 1, Archived = 2 }