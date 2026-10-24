using System.Linq.Expressions;
using UFMDb.Application.DTOs;
using UFMDb.Domain.Entities;

namespace UFMDb.Application.Common;

public static class MovieProjections
{
    public static Expression<Func<Movie, MovieListItemDto>> ListItem(bool isTr) =>
        m => new MovieListItemDto(
            m.Id,
            isTr && m.TitleTr != "" ? m.TitleTr : m.Title,
            m.ReleaseYear, m.PosterUrl, (decimal)m.AverageRating, m.RatingCount,
            m.MovieGenres
                .Select(mg => isTr && mg.Genre.NameTr != "" ? mg.Genre.NameTr : mg.Genre.Name)
                .ToList(),
            m.BackdropUrl,
            isTr && m.OverviewTr != "" ? m.OverviewTr : m.Overview,
            false, false, false, m.ReleaseDate, null);
}