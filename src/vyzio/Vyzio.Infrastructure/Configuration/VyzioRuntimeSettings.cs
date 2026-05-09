namespace Vyzio.Infrastructure.Configuration;

public class VyzioRuntimeSettings
{
    public DatabaseSettings Database { get; init; } = new();

    public sealed class DatabaseSettings
    {
        public string ConnectionString { get; init; } = "Data Source=./data/vyzio.db";
    }
}
