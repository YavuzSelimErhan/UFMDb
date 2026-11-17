using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.WebUtilities;
using UFMDb.Tools.TmdbImporter;
using Xunit;

namespace UFMDb.Tests.Importer;

public class TmdbClientTests
{
    private sealed class TmdbStub(Func<HttpRequestMessage, HttpResponseMessage> respond) : HttpMessageHandler
    {
        public int Requests { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Requests++;
            return Task.FromResult(respond(request));
        }
    }

    [Fact]
    public async Task Discover_SendsCountryVoteAndDateFilters_AndReadsSnakeCaseFields()
    {
        using var stub = new TmdbStub(request =>
        {
            var url = request.RequestUri!;
            Assert.Equal("/3/discover/movie", url.AbsolutePath);
            var query = QueryHelpers.ParseQuery(url.Query);
            Assert.Equal("TR", query["with_origin_country"].ToString());
            Assert.Equal("100", query["vote_count.gte"].ToString());
            Assert.Equal("2", query["page"].ToString());
            Assert.Equal("1970-01-01", query["primary_release_date.gte"].ToString());
            Assert.Equal("1979-12-31", query["primary_release_date.lte"].ToString());
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = JsonContent.Create(new { total_pages = 3, results = new[] { new { id = 42, vote_count = 123 } } })
            };
        });
        using var http = new HttpClient(stub) { BaseAddress = new Uri("https://example.test/3/") };
        var result = await new TmdbClient("test", http).DiscoverMoviesAsync(2, 100, default,
            "1970-01-01", "1979-12-31", originCountry: "TR");
        Assert.Equal(3, result.TotalPages);
        Assert.Equal(123, Assert.Single(result.Results).VoteCount);
    }

    [Theory]
    [InlineData(HttpStatusCode.TooManyRequests, 4)]
    [InlineData(HttpStatusCode.ServiceUnavailable, 4)]
    [InlineData(HttpStatusCode.NotFound, 1)]
    public async Task Detail_ReturnsNullAfterBoundedRetries(HttpStatusCode status, int expectedCalls)
    {
        using var stub = new TmdbStub(_ => new HttpResponseMessage(status)
        {
            Headers = { RetryAfter = new RetryConditionHeaderValue(TimeSpan.Zero) }
        });
        using var http = new HttpClient(stub) { BaseAddress = new Uri("https://example.test/3/") };
        Assert.Null(await new TmdbClient("test", http).GetMovieDetailAsync(42, default));
        Assert.Equal(expectedCalls, stub.Requests);
    }

    [Fact]
    public async Task Detail_RecoversOnNextAttempt()
    {
        var first = true;
        using var stub = new TmdbStub(_ =>
        {
            if (first)
            {
                first = false;
                return new HttpResponseMessage(HttpStatusCode.TooManyRequests)
                {
                    Headers = { RetryAfter = new RetryConditionHeaderValue(TimeSpan.Zero) }
                };
            }
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = JsonContent.Create(new { id = 42, original_title = "Umut" })
            };
        });
        using var http = new HttpClient(stub) { BaseAddress = new Uri("https://example.test/3/") };
        var detail = await new TmdbClient("test", http).GetMovieDetailAsync(42, default);
        Assert.Equal("Umut", detail?.OriginalTitle);
        Assert.Equal(2, stub.Requests);
    }
}
