using UFMDb.Application.Features.Compatibility;
using UFMDb.Domain.Entities;
using UFMDb.Tests.TestHelpers;
using Xunit;

namespace UFMDb.Tests.Compatibility;

public class GetCompatibilityFilmsQueryHandlerTests
{
    // User'ın zorunlu alanları varsa (PasswordHash vb.) buraya ekle.
    private static User NewUser(string name, bool active = true) =>
    new()
    {
        UserName = name,
        Email = $"{name}@test.com",
        PasswordHash = "hash",
        PasswordSalt = "salt",
        IsActive = active,
    };

    private static Movie NewMovie(string title, string titleTr) =>
        new() { Title = title, TitleTr = titleTr, OriginalTitle = title, ReleaseYear = 2014, PosterUrl = "/p.jpg" };

    [Fact]
    public async Task Handle_OwnProfile_ThrowsValidationException()
    {
        await using var ctx = TestDbContextFactory.Create();
        var handler = new GetCompatibilityFilmsQueryHandler(ctx);
        var id = Guid.NewGuid();

        await Assert.ThrowsAsync<UFMDb.Application.Common.Exceptions.ValidationException>(() =>
            handler.Handle(new GetCompatibilityFilmsQuery(id, id), CancellationToken.None));
    }

    [Fact]
    public async Task Handle_UnknownTarget_ThrowsNotFound()
    {
        await using var ctx = TestDbContextFactory.Create();
        var handler = new GetCompatibilityFilmsQueryHandler(ctx);

        await Assert.ThrowsAsync<UFMDb.Application.Common.Exceptions.NotFoundException>(() =>
            handler.Handle(new GetCompatibilityFilmsQuery(Guid.NewGuid(), Guid.NewGuid()), CancellationToken.None));
    }

    [Fact]
    public async Task Handle_InactiveTarget_ThrowsNotFound()
    {
        await using var ctx = TestDbContextFactory.Create();
        var viewer = NewUser("viewer");
        var deleted = NewUser("deleted", active: false);
        ctx.Users.AddRange(viewer, deleted);
        await ctx.SaveChangesAsync();

        await Assert.ThrowsAsync<UFMDb.Application.Common.Exceptions.NotFoundException>(() =>
            new GetCompatibilityFilmsQueryHandler(ctx)
                .Handle(new GetCompatibilityFilmsQuery(viewer.Id, deleted.Id), CancellationToken.None));
    }

    [Fact]
    public async Task Handle_ReturnsAgreementsAndDisagreements_WithLocalizedTitles()
    {
        await using var ctx = TestDbContextFactory.Create();
        var viewer = NewUser("viewer");
        var target = NewUser("target");
        var same = NewMovie("Same", "Aynı");
        var apart = NewMovie("Apart", "Ayrı");
        ctx.Users.AddRange(viewer, target);
        ctx.Movies.AddRange(same, apart);
        ctx.MovieRatings.AddRange(
            new MovieRating { UserId = viewer.Id, MovieId = same.Id, Value = 4.0m },
            new MovieRating { UserId = target.Id, MovieId = same.Id, Value = 4.0m },
            new MovieRating { UserId = viewer.Id, MovieId = apart.Id, Value = 5.0m },
            new MovieRating { UserId = target.Id, MovieId = apart.Id, Value = 2.0m });
        await ctx.SaveChangesAsync();

        var result = await new GetCompatibilityFilmsQueryHandler(ctx)
            .Handle(new GetCompatibilityFilmsQuery(viewer.Id, target.Id, "tr"), CancellationToken.None);

        var agreement = Assert.Single(result.Agreements);
        Assert.Equal("Aynı", agreement.Title);

        var disagreement = Assert.Single(result.Disagreements);
        Assert.Equal("Ayrı", disagreement.Title);
        Assert.Equal(5.0m, disagreement.MyRating);
        Assert.Equal(2.0m, disagreement.TheirRating);
        Assert.Equal(3.0m, disagreement.Difference);

        Assert.Equal(1.5m, result.AverageDifference); // (0 + 3.0) / 2
    }
}