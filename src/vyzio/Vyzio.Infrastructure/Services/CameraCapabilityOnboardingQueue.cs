using System.Threading.Channels;
using Vyzio.Core.Interfaces;

namespace Vyzio.Infrastructure.Services;

internal sealed class CameraCapabilityOnboardingQueue : ICameraCapabilityOnboardingQueue
{
    private readonly Channel<string> _channel = Channel.CreateUnbounded<string>(
        new UnboundedChannelOptions { SingleReader = true });

    public void Enqueue(string cameraId) => _channel.Writer.TryWrite(cameraId);

    public ValueTask<string> DequeueAsync(CancellationToken ct = default)
        => _channel.Reader.ReadAsync(ct);
}
