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
