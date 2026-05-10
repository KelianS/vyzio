namespace Vyzio.Infrastructure.Configuration;

public class VyzioRuntimeSettings
{
    public DatabaseSettings Database { get; init; } = new();
    public FrigateSettings Frigate { get; init; } = new();

    public sealed class DatabaseSettings
    {
        public string ConnectionString { get; init; } = "Data Source=./data/vyzio.db";
    }

    public sealed class FrigateSettings
    {
        public IReadOnlyList<string> RetainedLabels { get; init; } = Array.Empty<string>();
    }
}
