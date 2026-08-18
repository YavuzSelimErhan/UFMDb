using System.Net.Http.Json;
using System.Text.Json;
using UFMDb.Tools.TmdbImporter.Models;

namespace UFMDb.Tools.TmdbImporter;

public class TmdbClient
{
    private readonly HttpClient _http;
    private readonly string _apiKey;
    private readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        PropertyNameCaseInsensitive = true
    };

    public const string ImageBaseUrl = "https://image.tmdb.org/t/p/";

    public TmdbClient(string apiKey)
    {
        _apiKey = apiKey;
        _http = new HttpClient { BaseAddress = new Uri("https://api.themoviedb.org/3/") };
    }

    public async Task<TmdbGenreListResponse> GetGenresAsync(CancellationToken ct)
    {
        var response = await _http.GetAsync($"genre/movie/list?api_key={_apiKey}&language=en-US", ct);
        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<TmdbGenreListResponse>(_jsonOptions, ct);
        return result ?? new TmdbGenreListResponse();
    }

    public async Task<TmdbDiscoverResponse> DiscoverMoviesAsync(
    int page,
    int minVoteCount,
    CancellationToken ct,
    string? releaseDateGte = null,
    string? releaseDateLte = null)
    {
        var url = $"discover/movie?api_key={_apiKey}&language=en-US&sort_by=vote_average.desc" +
                  $"&include_adult=false&include_video=false&page={page}&vote_count.gte={minVoteCount}";

        // Decade bazlı taramada belirli bir yıl aralığına sıkıştırmak için kullanılır.
        if (!string.IsNullOrEmpty(releaseDateGte))
            url += $"&primary_release_date.gte={releaseDateGte}";
        if (!string.IsNullOrEmpty(releaseDateLte))
            url += $"&primary_release_date.lte={releaseDateLte}";

        var response = await _http.GetAsync(url, ct);
        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<TmdbDiscoverResponse>(_jsonOptions, ct);
        return result ?? new TmdbDiscoverResponse();
    }

    public async Task<TmdbMovieDetail?> GetMovieDetailAsync(int tmdbMovieId, CancellationToken ct)
    {
        var url = $"movie/{tmdbMovieId}?api_key={_apiKey}&language=en-US&append_to_response=credits";
        var response = await _http.GetAsync(url, ct);
        if (!response.IsSuccessStatusCode) return null; // bazı filmler kaldırılmış/erişilemez olabilir, atla
        return await response.Content.ReadFromJsonAsync<TmdbMovieDetail>(_jsonOptions, ct);
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


