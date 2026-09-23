using System.Collections.Concurrent;
using System.Globalization;
using System.Net;
using System.Net.Sockets;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Time.Testing;

namespace Vyzio.Tests.Services.Hosting;

// Drives a hosted service's loop through fake time; real time only paces the steps and bounds the wait.
internal static class BackgroundLoop
{
    private static readonly TimeSpan Guard = TimeSpan.FromSeconds(15);
    private static readonly TimeSpan Pace = TimeSpan.FromMilliseconds(10);
    private static readonly TimeSpan StopGuard = TimeSpan.FromSeconds(5);

    public static FakeTimeProvider ClockAt(string instant) =>
        new(DateTimeOffset.Parse(instant, CultureInfo.InvariantCulture));

    // Steps fake time until the effect shows, so a test never depends on when the loop armed its timer.
    public static async Task AdvanceUntilAsync(this FakeTimeProvider time, Task effect, TimeSpan step)
    {
        var deadline = DateTime.UtcNow + Guard;
        while (!effect.IsCompleted && DateTime.UtcNow < deadline)
        {
            time.Advance(step);
            await Task.WhenAny(effect, Task.Delay(Pace));
        }

        await effect.WaitAsync(TimeSpan.Zero);
    }

    // Bounded under every real back-off, so a loop that ignores cancellation fails instead of hanging the run.
    public static async Task StopWithinGuardAsync(this BackgroundService service)
    {
        using var guard = new CancellationTokenSource(StopGuard);
        await service.StopAsync(guard.Token);
    }

    // Waits for an effect that needs no time to pass, such as a queue being drained.
    public static Task ObservedAsync(this Task effect) => effect.WaitAsync(Guard);

    public static Task<T> ObservedAsync<T>(this Task<T> effect) => effect.WaitAsync(Guard);

    public static IServiceScopeFactory Scopes(Action<IServiceCollection> register)
    {
        var services = new ServiceCollection();
        register(services);
        return services.BuildServiceProvider().GetRequiredService<IServiceScopeFactory>();
    }

    // A loopback port nothing listens on, so a connection to it is refused at once.
    public static int ClosedPort()
    {
        var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var port = ((IPEndPoint)listener.LocalEndpoint).Port;
        listener.Stop();
        return port;
    }
}

// Signals when the service first logs at a level, so a test acts once a milestone or a failure is behind it.
internal sealed class LogSignal<T> : ILogger<T>
{
    private readonly ConcurrentDictionary<LogLevel, TaskCompletionSource> _reached = new();

    // Ask before starting the service: a level logged earlier is not remembered.
    public Task Reached(LogLevel level) =>
        _reached.GetOrAdd(level, _ => new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously)).Task;

    public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

    public bool IsEnabled(LogLevel logLevel) => true;

    public void Log<TState>(LogLevel logLevel, EventId eventId,
        TState state, Exception? exception, Func<TState, Exception?, string> formatter)
    {
        foreach (var (level, reached) in _reached)
        {
            if (logLevel >= level) reached.TrySetResult();
        }
    }
}
