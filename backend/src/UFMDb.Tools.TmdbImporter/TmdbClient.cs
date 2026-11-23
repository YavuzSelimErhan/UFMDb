using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using UFMDb.Tools.TmdbImporter.Models;

namespace UFMDb.Tools.TmdbImporter;

public class TmdbClient
{
    private readonly ArchiveRequestPacer _archivePacer = new();
    private readonly HttpClient _http;
    private readonly string _apiKey;
    private readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        PropertyNameCaseInsensitive = true
    };

    public const string ImageBaseUrl = "https://image.tmdb.org/t/p/";

    public TmdbClient(string apiKey) : this(apiKey, CreateHttpClient()) { }

    public TmdbClient(string apiKey, HttpClient httpClient)
    {
        _http = httpClient;
        _apiKey = apiKey;
    }

    private static HttpClient CreateHttpClient()
    {
        var handler = new SocketsHttpHandler
        {
            AutomaticDecompression = DecompressionMethods.All,
            EnableMultipleHttp2Connections = true,
            PooledConnectionLifetime = TimeSpan.FromMinutes(5)
        };
        return new HttpClient(handler)
        {
            BaseAddress = new Uri("https://api.themoviedb.org/3/"),
            DefaultRequestVersion = HttpVersion.Version20,
            DefaultVersionPolicy = HttpVersionPolicy.RequestVersionOrLower
        };
    }

    public async Task<TmdbGenreListResponse> GetGenresAsync(CancellationToken ct)
    {
        var response = await _http.GetAsync($"genre/movie/list?api_key={_apiKey}&language=en-US", ct);
        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<TmdbGenreListResponse>(_jsonOptions, ct);
        return result ?? new TmdbGenreListResponse();
    }

    public async Task<List<TmdbCountry>> GetCountriesConfigAsync(CancellationToken ct)
    {
        var response = await _http.GetAsync($"configuration/countries?api_key={_apiKey}", ct);
        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<List<TmdbCountry>>(_jsonOptions, ct);
        return result ?? new List<TmdbCountry>();
    }

    public async Task<TmdbDiscoverResponse> DiscoverMoviesAsync(
        int page,
        int minVoteCount,
        CancellationToken ct,
        string? releaseDateGte = null,
        string? releaseDateLte = null,
        string sortBy = "vote_count.desc",
        string? originCountry = null)
    {
        var url = $"discover/movie?api_key={_apiKey}&language=en-US&sort_by={sortBy}" +
                  $"&include_adult=false&include_video=false&page={page}&vote_count.gte={minVoteCount}";

        if (!string.IsNullOrEmpty(releaseDateGte))
            url += $"&primary_release_date.gte={releaseDateGte}";

        if (!string.IsNullOrEmpty(releaseDateLte))
            url += $"&primary_release_date.lte={releaseDateLte}";

        if (!string.IsNullOrWhiteSpace(originCountry))
            url += $"&with_origin_country={originCountry}";

        var response = await _http.GetAsync(url, ct);
        response.EnsureSuccessStatusCode();

        var result = await response.Content.ReadFromJsonAsync<TmdbDiscoverResponse>(
            _jsonOptions,
            ct);

        return result ?? new TmdbDiscoverResponse();
    }

    public Task<TmdbMovieDetail?> GetMovieDetailAsync(int tmdbMovieId, CancellationToken ct) =>
        FetchDetailAsync(tmdbMovieId, "credits,keywords,images,release_dates,videos,translations", ct);

    public Task<TmdbMovieDetail?> GetCreditDetailAsync(int tmdbMovieId, CancellationToken ct) =>
        FetchDetailAsync(tmdbMovieId, "credits", ct);

    private async Task<TmdbMovieDetail?> FetchDetailAsync(int tmdbMovieId, string append, CancellationToken ct)
    {
        var url = $"movie/{tmdbMovieId}?api_key={_apiKey}&language=en-US&append_to_response={append}" +
                  "&include_image_language=en,tr,null&include_video_language=en,tr,null";

        for (var attempt = 0; attempt < 4; attempt++)
        {
            var paced = append == "credits";
            if (paced) await _archivePacer.WaitAsync(ct);
            using var response = await _http.GetAsync(url, ct);

            if ((int)response.StatusCode == 429 || (int)response.StatusCode >= 500)
            {
                var retry = response.Headers.RetryAfter;
                var wait = retry?.Delta ?? (retry?.Date - DateTimeOffset.UtcNow) ?? TimeSpan.FromSeconds(1 << attempt);
                if (wait < TimeSpan.Zero) wait = TimeSpan.Zero;
                if (paced && (int)response.StatusCode == 429)
                {
                    _archivePacer.BackOff(wait);
                    if (attempt == 3) response.EnsureSuccessStatusCode();
                    continue;
                }
                await Task.Delay(wait, ct);
                continue;
            }

            if (!response.IsSuccessStatusCode) return null; // kaldırılmış/erişilemez film
            return await response.Content.ReadFromJsonAsync<TmdbMovieDetail>(_jsonOptions, ct);
        }
        return null;
    }

    public async Task<TmdbPersonDetail?> GetPersonDetailAsync(int personId, CancellationToken ct)
    {
        var url = $"person/{personId}?api_key={_apiKey}&language=en-US";
        var response = await _http.GetAsync(url, ct);
        if (!response.IsSuccessStatusCode) return null; // kişi silinmiş/erişilemez olabilir
        return await response.Content.ReadFromJsonAsync<TmdbPersonDetail>(_jsonOptions, ct);
    }

    public static string? BuildImageUrl(string? path, string size) =>
        string.IsNullOrEmpty(path) ? null : $"{ImageBaseUrl}{size}{path}";
}