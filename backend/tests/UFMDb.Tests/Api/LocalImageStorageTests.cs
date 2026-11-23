using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Logging.Abstractions;
using ImageMagick;
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
    [InlineData(ImageKind.Avatar, "avatars", 512, 512, MagickFormat.Png)]
    [InlineData(ImageKind.Avatar, "avatars", 512, 512, MagickFormat.Jpeg)]
    [InlineData(ImageKind.Cover, "covers", 1600, 800, MagickFormat.WebP)]
    public async Task Save_ConvertsUploadToWebpWithExpectedDimensions_AndDeletesManagedFile(
        ImageKind kind, string folder, int width, int height, MagickFormat format)
    {
        using var source = new MagickImage(MagickColors.Red, 1800, 900);
        using var stream = new MemoryStream();
        source.Write(stream, format);
        stream.Position = 0;
        var url = await storage.SaveAsync(stream, kind);
        Assert.Matches($"^/api/uploads/{folder}/[0-9a-f]{{32}}\\.webp$", url);
        var path = Path.Combine(root.FullName, "uploads", folder, Path.GetFileName(url));
        var info = new MagickImageInfo(path);
        Assert.Equal(MagickFormat.WebP, info.Format);
        Assert.Equal((width, height), ((int)info.Width, (int)info.Height));
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
