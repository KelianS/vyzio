namespace Vyzio.Core.Interfaces;

public interface ICameraCapabilityOnboardingQueue
{
    void Enqueue(string cameraId);
    ValueTask<string> DequeueAsync(CancellationToken ct = default);
}
