using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Logging.Abstractions;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using UFMDb.API.Services;
using UFMDb.Application.Common.Exceptions;
using UFMDb.Application.Common.Interfaces;
using Xunit;

namespace UFMDb.Tests.Api;

public class LocalImageStorageTests : IDisposable
{
    private readonly DirectoryInfo root = Directory.CreateTempSubdirectory("ufmdb-images-");
    private readonly LocalImageStorage storage;

    public LocalImageStorageTests()
    {
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions { WebRootPath = root.FullName });
        storage = new LocalImageStorage(builder.Environment, NullLogger<LocalImageStorage>.Instance);
    }

    public void Dispose() => root.Delete(true);

    [Theory]
    [InlineData(ImageKind.Avatar, "avatars", 512, 512)]
    [InlineData(ImageKind.Cover, "covers", 1600, 800)]
    public async Task Save_ConvertsPngToWebpWithExpectedDimensions_AndDeletesManagedFile(
        ImageKind kind, string folder, int width, int height)
    {
        using var source = new Image<Rgba32>(1800, 900);
        using var stream = new MemoryStream();
        await source.SaveAsPngAsync(stream);
        stream.Position = 0;
        var url = await storage.SaveAsync(stream, kind);
        Assert.Matches($"^/api/uploads/{folder}/[0-9a-f]{{32}}\\.webp$", url);
        var path = Path.Combine(root.FullName, "uploads", folder, Path.GetFileName(url));
        var info = await Image.IdentifyAsync(path);
        Assert.Equal("image/webp", info.Metadata.DecodedImageFormat?.DefaultMimeType);
        Assert.Equal((width, height), (info.Width, info.Height));
        storage.Delete(url);
        storage.Delete(url);
        Assert.False(File.Exists(path));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(16)]
    [InlineData(5 * 1024 * 1024 + 1)]
    public async Task RejectedInputLeavesNoFile(int length)
    {
        using var stream = new MemoryStream(new byte[length]);
        await Assert.ThrowsAsync<ValidationException>(() => storage.SaveAsync(stream, ImageKind.Cover));
        Assert.Empty(root.EnumerateFiles("*", SearchOption.AllDirectories));
    }
}
