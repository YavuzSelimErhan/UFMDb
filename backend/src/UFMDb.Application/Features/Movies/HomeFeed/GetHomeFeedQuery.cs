using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using UFMDb.Application.Common;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Application.DTOs;
namespace UFMDb.Application.Features.Movies.HomeFeed;

public record HomeFeedDto(
    List<MovieListItemDto> Featured,
    List<MovieListItemDto> Popular,
    List<MovieListItemDto> TopRated,
    List<MovieListItemDto> Trending
);

// Misafir kullanıcılar da ana sayfayı görebildiği için UserId opsiyonel
public record GetHomeFeedQuery(Guid? UserId, string Lang = "en") : IRequest<HomeFeedDto>;

public class GetHomeFeedQueryHandler : IRequestHandler<GetHomeFeedQuery, HomeFeedDto>
{
    private static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(5);
    private const int FeaturedCount = 6;

    private readonly IApplicationDbContext _context;
    private readonly IMemoryCache _cache;

    public GetHomeFeedQueryHandler(IApplicationDbContext context, IMemoryCache cache)
    {
        _context = context;
        _cache = cache;
    }

    public async Task<HomeFeedDto> Handle(GetHomeFeedQuery request, CancellationToken ct)
    {
        var isTr = Localization.IsTurkish(request.Lang);

        // Önbellekte kullanıcıya özel hiçbir şey yok; bayraklar aşağıda her istekte uygulanıyor.
        // Not: soğuk önbellekte eşzamanlı istekler birden fazla kez build edebilir, bu zararsız.
        var feed = (await _cache.GetOrCreateAsync($"home-feed:{(isTr ? "tr" : "en")}", entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = CacheDuration;
            return BuildFeedAsync(isTr, ct);
        }))!;

        return request.UserId is Guid uid ? await ApplyUserFlagsAsync(feed, uid, ct) : feed;
    }

    private async Task<HomeFeedDto> BuildFeedAsync(bool isTr, CancellationToken ct)
    {
        var baseQuery = _context.Movies.AsNoTracking().Where(m => !m.IsDeleted);
        var projection = MovieProjections.ListItem(isTr);
        var minVotes = Math.Max(1.0, (double)RatingRankPolicy.MinVotesForRatingRank);

        // Featured (hero carousel): önce KATI eşiği geçenler (az oylu, "şans eseri" yüksek ortalamalı
        // filmler görünmesin). Yeterli film yoksa carousel boş kalmasın diye popülerliğe göre tamamlanır.
        var featured = await baseQuery
            .Where(m => m.RatingCount >= RatingRankPolicy.MinVotesForRatingRank)
            .OrderByDescending(m => m.AverageRating * 1000 + m.LikeCount)
            .Take(FeaturedCount).Select(projection).ToListAsync(ct);

        if (featured.Count < FeaturedCount)
        {
            var have = featured.Select(f => f.Id).ToList();
            var filler = await baseQuery
                .Where(m => !have.Contains(m.Id) && m.BackdropUrl != "")
                .OrderByDescending(m => m.TmdbPopularity)
                .Take(FeaturedCount - featured.Count).Select(projection).ToListAsync(ct);
            featured.AddRange(filler);
        }

        // Popular: TMDB popülerliği önce (yeni katalogda LikeCount hep 0), eşitlikte site beğenisi.
        var popular = await baseQuery
            .OrderByDescending(m => m.TmdbPopularity)
            .ThenByDescending(m => m.LikeCount)
            .Take(12).Select(projection).ToListAsync(ct);

        // Top Rated: az oylu filmleri gizlemiyoruz, Bayesian ağırlıklı puanla sıralıyoruz:
        //   WR = (v*R + m*C) / (v + m)   (C = tüm katalogun ortalaması)
        var globalMean = (await baseQuery.AverageAsync(m => (double?)m.AverageRating, ct)) ?? 0.0;
        var topRated = await baseQuery
            .OrderByDescending(m => (m.RatingCount * m.AverageRating + minVotes * globalMean) / (m.RatingCount + minVotes))
            .ThenByDescending(m => m.RatingCount)
            .ThenBy(m => m.Id)
            .Take(12).Select(projection).ToListAsync(ct);

        // Trending: site içi hareket önce; hareket yoksa (eşitlikte) TMDB popülerliği.
        var trending = await baseQuery
            .OrderByDescending(m => m.ViewCount * 0.6 + m.LikeCount * 0.4)
            .ThenByDescending(m => m.TmdbPopularity)
            .Take(12).Select(projection).ToListAsync(ct);

        return new HomeFeedDto(featured, popular, topRated, trending);
    }

    private async Task<HomeFeedDto> ApplyUserFlagsAsync(HomeFeedDto feed, Guid userId, CancellationToken ct)
    {
        // Dört listeyi tek seferde bayraklıyoruz (sorgu sayısı aynı); ApplyAsync sırayı ve
        // eleman sayısını korur, bu yüzden sonucu tekrar dilimleyebiliriz.
        var all = feed.Featured.Concat(feed.Popular).Concat(feed.TopRated).Concat(feed.Trending).ToList();
        var flagged = await MovieUserFlags.ApplyAsync(_context, all, userId, ct);

        var skip = 0;
        List<MovieListItemDto> Take(int count)
        {
            var slice = flagged.Skip(skip).Take(count).ToList();
            skip += count;
            return slice;
        }

        // Yeni liste üretiyoruz: önbellekteki ortak listeleri yerinde değiştirmemek için şart.
        return new HomeFeedDto(
            Take(feed.Featured.Count), Take(feed.Popular.Count),
            Take(feed.TopRated.Count), Take(feed.Trending.Count));
    }
}