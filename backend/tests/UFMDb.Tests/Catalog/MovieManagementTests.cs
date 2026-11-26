using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common.Exceptions;
using UFMDb.Application.Features.Movies.ManageMovie;
using UFMDb.Domain.Entities;
using UFMDb.Tests.TestHelpers;
using Xunit;

namespace UFMDb.Tests.Catalog;

public class MovieManagementTests
{
    [Fact]
    public async Task CatalogEdit_ReplacesCredits_PreservesLocalVotes_AndDistinguishesMissingFromEmptyText()
    {
        await using var db = TestDbContextFactory.Create();
        var director = Guid.NewGuid();
        var newDirector = Guid.NewGuid();
        var actor = Guid.NewGuid();
        var genre = Guid.NewGuid();
        var added = new CreateMovieCommand("Hope", "Umut", "", 1970, new DateTime(1970, 1, 1),
            100, "", "", [director, director], "Turkey", [genre, genre],
            [new(actor, "A", 0), new(actor, "Duplicate", 1)], 4, TitleTr: "Umut", Tagline: "Original");
        var id = await new CreateMovieCommandHandler(db).Handle(added, default);

        Assert.Equal(1, await db.MovieCredits.CountAsync(c => c.Kind == CreditKind.Crew && c.Job == "Director"));
        Assert.Equal("A", (await db.MovieCredits.AsNoTracking().SingleAsync(c => c.Kind == CreditKind.Cast)).CharacterName);

        db.MovieRatings.Add(new MovieRating { MovieId = id, UserId = Guid.NewGuid(), Value = 3 });
        // Importer'ýn eklediði baþka bir crew kredisi: admin düzenlemesi buna dokunmamalý.
        db.MovieCredits.Add(new MovieCredit
        {
            MovieId = id,
            PersonId = Guid.NewGuid(),
            Kind = CreditKind.Crew,
            Department = "Writing",
            Job = "Writer",
            TmdbCreditId = "writer-credit"
        });
        await db.SaveChangesAsync();

        var edit = new UpdateMovieCommand(id, "Hope", "Umut", "", 1970, added.ReleaseDate,
            101, "", "", [newDirector, director], "Turkey", [], [new(actor, "Lead", 0)], 5, Tagline: "");
        await new UpdateMovieCommandHandler(db).Handle(edit, default);
        var saved = await db.Movies.AsNoTracking().SingleAsync();
        Assert.Equal(("Umut", "", 101), (saved.TitleTr, saved.Tagline, saved.RuntimeMinutes));
        Assert.Equal(DateTimeKind.Utc, saved.ReleaseDate.Kind);
        Assert.Equal((3.0, 1), (saved.AverageRating, saved.RatingCount));
        Assert.Empty(await db.Set<MovieGenre>().ToListAsync());
        Assert.Equal(new[] { newDirector, director }, await db.MovieCredits.AsNoTracking()
            .Where(c => c.Kind == CreditKind.Crew && c.Job == "Director")
            .OrderBy(c => c.Order).Select(c => c.PersonId).ToListAsync());
        Assert.Equal("Lead", (await db.MovieCredits.AsNoTracking().SingleAsync(c => c.Kind == CreditKind.Cast)).CharacterName);
        Assert.Equal(1, await db.MovieCredits.CountAsync(c => c.Job == "Writer"));

        await new DeleteMovieCommandHandler(db).Handle(new(id), default);
        await Assert.ThrowsAsync<NotFoundException>(() => new UpdateMovieCommandHandler(db).Handle(edit, default));
        Assert.True((await db.Movies.IgnoreQueryFilters().AsNoTracking().SingleAsync()).IsDeleted);
    }
}