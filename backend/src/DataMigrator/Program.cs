using Microsoft.Data.SqlClient;
using Npgsql;

// ==== BURAYI KENDİ BİLGİLERİNİZLE DOLDURUN ====
string sourceConnStr = "Server=tcp:ufmdb-server-yavuz.database.windows.net,1433;Initial Catalog=UFMDb;User ID=ufmdbadmin;Password=Pok1Pok2;Encrypt=True;TrustServerCertificate=False;";
string destConnStr = "Host=ep-blue-forest-b2pt1lwm-pooler.c-6.eu-central-1.aws.neon.tech;Port=5432;Database=neondb;Username=neondb_owner;Password=npg_sZM0qxf2PUQJ;SSL Mode=Require;Trust Server Certificate=true";

// Foreign key bağımlılık sırasına göre tablolar (önce bağımsızlar, sonra bağımlılar)
string[] tables = new[]
{
    "Countries", "Genres", "Actors", "Directors", "Users", "CuratedLists",
    "Movies",
    "MovieGenres", "MovieActors", "MovieDirectors",
    "Reviews", "Likes", "WatchlistItems", "FavoriteMovies", "WatchHistory",
    "CuratedListItems", "RefreshTokens",
    "ActorLikes", "FavoriteActors", "DirectorLikes", "FavoriteDirectors"
};

var stopwatch = System.Diagnostics.Stopwatch.StartNew();

foreach (var table in tables)
{
    Console.WriteLine($"Aktarılıyor: {table} ...");
    try
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();
        int count = await CopyTableFastAsync(table, sourceConnStr, destConnStr);
        Console.WriteLine($"  Tamamlandı: {table} — {count} satır — {sw.ElapsedMilliseconds}ms");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"  HATA ({table}): {ex.Message}");
    }
}

Console.WriteLine("Tüm tablolar işlendi. Şimdi sequence'ları sıfırlıyorum...");
await ResetSequencesAsync(tables, destConnStr);
Console.WriteLine($"Bitti. Toplam süre: {stopwatch.Elapsed}");

static async Task<int> CopyTableFastAsync(string table, string sourceConnStr, string destConnStr)
{
    using var sourceConn = new SqlConnection(sourceConnStr);
    await sourceConn.OpenAsync();

    using var cmd = new SqlCommand($"SELECT * FROM [{table}]", sourceConn);
    using var reader = await cmd.ExecuteReaderAsync();

    var columnNames = new List<string>();
    for (int i = 0; i < reader.FieldCount; i++)
        columnNames.Add(reader.GetName(i));

    using var destConn = new NpgsqlConnection(destConnStr);
    await destConn.OpenAsync();

    // Önce hedef tabloyu temizle (idempotent yeniden çalıştırma için)
    using (var truncateCmd = new NpgsqlCommand($"TRUNCATE TABLE \"{table}\" CASCADE", destConn))
        await truncateCmd.ExecuteNonQueryAsync();

    var colList = string.Join(", ", columnNames.Select(c => $"\"{c}\""));
    var copyCmd = $"COPY \"{table}\" ({colList}) FROM STDIN (FORMAT BINARY)";

    int rowCount = 0;
    using (var importer = destConn.BeginBinaryImport(copyCmd))
    {
        while (await reader.ReadAsync())
        {
            importer.StartRow();
            for (int i = 0; i < columnNames.Count; i++)
            {
                var value = reader.GetValue(i);
                if (value == DBNull.Value)
                    importer.WriteNull();
                else
                    importer.Write(value);
            }
            rowCount++;
        }
        await importer.CompleteAsync();
    }
    return rowCount;
}

static async Task ResetSequencesAsync(string[] tables, string destConnStr)
{
    using var destConn = new NpgsqlConnection(destConnStr);
    await destConn.OpenAsync();

    foreach (var table in tables)
    {
        try
        {
            var sql = $@"
                SELECT setval(
                    pg_get_serial_sequence('""{table}""', 'Id'),
                    COALESCE((SELECT MAX(""Id"") FROM ""{table}""), 1)
                )";
            using var cmd = new NpgsqlCommand(sql, destConn);
            await cmd.ExecuteNonQueryAsync();
        }
        catch
        {
            // Bu tabloda "Id" sütunu/sequence yoksa (örn. composite key tabloları) atla
        }
    }
}