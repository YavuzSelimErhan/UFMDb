using Microsoft.EntityFrameworkCore;
using Npgsql;
using UFMDb.Persistence;
using Xunit;

namespace UFMDb.Tests.TestHelpers;

public sealed class PostgresFactAttribute : FactAttribute
{
    public const string ConnectionVariable = "UFMDB_TEST_POSTGRES";

    public PostgresFactAttribute()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable(ConnectionVariable)))
            Skip = $"Set {ConnectionVariable} to run with a disposable PostgreSQL instance.";
    }
}

public static class PostgresDatabase
{
    public static ApplicationDbContext CreateContext()
    {
        var connection = new NpgsqlConnectionStringBuilder(
            Environment.GetEnvironmentVariable(PostgresFactAttribute.ConnectionVariable))
        {
            Database = $"ufmdb_test_{Guid.NewGuid():N}",
            Pooling = false
        };
        return new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(connection.ConnectionString).Options);
    }

}
