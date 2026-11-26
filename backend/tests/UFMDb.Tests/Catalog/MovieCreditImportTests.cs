using Microsoft.EntityFrameworkCore;
using UFMDb.Domain.Entities;
using UFMDb.Tests.TestHelpers;
using UFMDb.Tools.TmdbImporter;
using UFMDb.Tools.TmdbImporter.Models;
using Xunit;

namespace UFMDb.Tests.Catalog;

public class MovieCreditImportTests
{
    [Fact]
    public async Task RepeatImport_ReusesMigratedRows_RemovesStaleTmdbCredits_AndKeepsManualCredits()
    {
        await using var db = TestDbContextFactory.Create();
        var film = new Movie { Title = "Film", OriginalTitle = "Film" };
        var actor = new Actor { TmdbId = 17, FullName = "Shared" };
        var director = new Director { TmdbId = 17, FullName = "Shared" };
        // Migration'dan gelmiþ kiþi: eski Actor/Director kimlikleriyle baðlý.
        var person = new Person
        {
            TmdbId = 17,
            FullName = "Shared",
            LegacyActorId = actor.Id,
            LegacyDirectorId = director.Id
        };

        // Migration'dan gelen, TmdbCreditId'si henüz olmayan satýrlar: importer bunlarý yeniden kullanmalý.
        var cast = new MovieCredit { MovieId = film.Id, PersonId = person.Id, Kind = CreditKind.Cast, Job = "Actor" };
        var directing = new MovieCredit { MovieId = film.Id, PersonId = person.Id, Kind = CreditKind.Crew, Job = "Director" };

        // Önceki bir senkronda TMDB'den gelmiþ ama artýk payload'da olmayan kredi: temizlenmeli.
        var staleTmdb = new MovieCredit
        {
            MovieId = film.Id,
            PersonId = person.Id,
            Kind = CreditKind.Crew,
            Job = "Assistant Camera",
            TmdbCreditId = "previous-pilot-credit"
        };

        // Elle (admin panelinden) eklenmiþ kredi: TmdbCreditId yok, senkron ona dokunmamalý.
        var manual = new MovieCredit
        {
            MovieId = film.Id,
            PersonId = person.Id,
            Kind = CreditKind.Crew,
            Department = "Crew",
            Job = "Gaffer"
        };

        db.AddRange(film, actor, director, person, cast, directing, staleTmdb, manual);
        db.Add(new MovieActor { MovieId = film.Id, ActorId = actor.Id, Order = 16 });
        await db.SaveChangesAsync();

        var payload = new TmdbCredits
        {
            // MaxCastPerMovie (12) içinde kaldýðý için "Outside roster" da eklenir.
            Cast = new() { new() { Id = 17, Name = "Shared", CreditId = "cast", Character = "Lead", Order = 16 },
                new() { Id = 91, Name = "Outside roster", CreditId = "extra", Order = 0 } },
            Crew = new()
            {
                new() { Id = 17, Name = "Shared", CreditId = "direct", Department = "Directing", Job = "Director" },
                new() { Id = 17, Name = "Shared", CreditId = "write", Department = "Writing", Job = "Screenplay" },
                new() { Id = 23, Name = "Composer", CreditId = "music", Department = "Sound", Job = "Original Music Composer" },
                // Seçili görevler listesinde olmayan görev: hiç eklenmez.
                new() { Id = 92, Name = "Assistant", CreditId = "assistant", Department = "Camera", Job = "Assistant Camera" }
            }
        };

        // Yeni satýrlar: extra, write, music. cast ve direct mevcut migration satýrlarýný yeniden kullanýr.
        Assert.Equal(3, await MovieCreditImport.MergeAsync(db, film.Id, payload, default));
        db.ChangeTracker.Clear();

        // Ayný veriyle tekrar çalýþtýrmak hiçbir þey eklemez.
        Assert.Equal(0, await MovieCreditImport.MergeAsync(db, film.Id, payload, default));

        // "music" TMDB'den kalkarsa kredisi temizlenir, kiþisi ise kalýr.
        payload.Crew.RemoveAt(2);
        Assert.Equal(0, await MovieCreditImport.MergeAsync(db, film.Id, payload, default));

        // Migration'dan gelen kiþi tekrar oluþturulmadý ve eski kimlikleri korundu.
        var shared = await db.People.SingleAsync(p => p.Id == person.Id);
        Assert.Equal(actor.Id, shared.LegacyActorId);
        Assert.Equal(director.Id, shared.LegacyDirectorId);
        Assert.Equal(3, await db.People.CountAsync()); // Shared, Outside roster, Composer

        // Kalan krediler: cast, direct, extra, write + elle eklenen.
        Assert.Equal(5, await db.MovieCredits.CountAsync());
        Assert.Equal(cast.Id, (await db.MovieCredits.SingleAsync(x => x.TmdbCreditId == "cast")).Id);
        Assert.Equal(directing.Id, (await db.MovieCredits.SingleAsync(x => x.TmdbCreditId == "direct")).Id);
        Assert.False(await db.MovieCredits.AnyAsync(c => c.Id == staleTmdb.Id));
        Assert.False(await db.MovieCredits.AnyAsync(c => c.TmdbCreditId == "music"));
        Assert.False(await db.MovieCredits.AnyAsync(c => c.TmdbCreditId == "assistant"));
        Assert.True(await db.MovieCredits.AnyAsync(c => c.Id == manual.Id && c.TmdbCreditId == null));

        await Assert.ThrowsAsync<InvalidDataException>(() => MovieCreditImport.MergeAsync(db, film.Id, null, default));
    }
}