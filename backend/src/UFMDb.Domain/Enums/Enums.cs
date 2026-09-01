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
    /// <summary>Vizyona girdi ama vizyon-sonrasý ikinci senkronizasyon henüz yapýlmadý (veriler henüz "olgunlaþmamýþ" olabilir).</summary>
    NewlyReleased = 1,
    /// <summary>Vizyon üzerinden yeterli süre geçti, veriler oturmuþ kabul edilir.</summary>
    Stable = 2
}