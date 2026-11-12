using Microsoft.Extensions.Logging;

namespace Vyzio.Tests;

// Keeps every formatted line, so a test can assert what an operator reads in the logs.
internal sealed class LogLines<T> : ILogger<T>
{
    public List<(LogLevel Level, string Message)> Lines { get; } = [];

    public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

    public bool IsEnabled(LogLevel logLevel) => true;

    public void Log<TState>(LogLevel logLevel, EventId eventId,
        TState state, Exception? exception, Func<TState, Exception?, string> formatter) =>
        Lines.Add((logLevel, formatter(state, exception)));
}
