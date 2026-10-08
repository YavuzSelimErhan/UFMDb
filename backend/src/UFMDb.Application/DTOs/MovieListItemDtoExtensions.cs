using UFMDb.Domain.Enums;
namespace UFMDb.Application.DTOs;

public static class MovieListItemDtoExtensions
{
    public static MovieListItemDto WithReaction(
        this MovieListItemDto dto, IReadOnlyDictionary<Guid, ReactionType> reactions)
    {
        ReactionType? reaction = reactions.TryGetValue(dto.Id, out var r) ? r : null;
        return dto with
        {
            CurrentUserReaction = reaction,
            IsLikedByCurrentUser = reaction == ReactionType.Like
        };
    }
}