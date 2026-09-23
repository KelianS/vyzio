using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Vyzio.Application.Services;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;
using Vyzio.Infrastructure.Services;
using Vyzio.Tests.Services.Hosting;

namespace Vyzio.Tests.Services;

public class CameraCapabilityOnboardingWorkerTests
{
    private readonly CameraCapabilityOnboardingQueue _queue = new();
    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly ICameraCapabilityBindingRepository _bindings = Substitute.For<ICameraCapabilityBindingRepository>();
    private readonly ICapabilityProviderRegistry _registry = Substitute.For<ICapabilityProviderRegistry>();

    private CameraCapabilityOnboardingWorker CreateSut() => new(
        _queue,
        BackgroundLoop.Scopes(services => services.AddSingleton(new SeedAndProbePresetsUseCase(
            _cameras, _bindings, new ProbeCameraCapabilityUseCase(_cameras, _bindings, _registry), _registry))),
        NullLogger<CameraCapabilityOnboardingWorker>.Instance);

    // The probe starts by loading the camera: an unknown one ends it there, which is all these tests need.
    private TaskCompletionSource SignalOnProbe(string cameraId)
    {
        var probed = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        _cameras.GetByIdAsync(cameraId, Arg.Any<CancellationToken>())
            .Returns(_ =>
            {
                probed.TrySetResult();
                return Task.FromResult<Camera?>(null);
            });
        return probed;
    }

    [Fact]
    public async Task ExecuteAsync_ShouldProbeTheCamera_WhenItIsAdded()
    {
        // Arrange
        var probed = SignalOnProbe("cam-1");
        var sut = CreateSut();
        await sut.StartAsync(CancellationToken.None);

        // Act
        _queue.Enqueue("cam-1");
        await probed.Task.ObservedAsync();
        await sut.StopAsync(CancellationToken.None);

        // Assert
        await _cameras.Received(1).GetByIdAsync("cam-1", Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldProbeTheNextCamera_WhenOneProbeFails()
    {
        // Arrange
        _cameras.GetByIdAsync("cam-1", Arg.Any<CancellationToken>())
            .Returns<Camera?>(_ => throw new InvalidOperationException("database is locked"));
        var probed = SignalOnProbe("cam-2");
        var sut = CreateSut();
        await sut.StartAsync(CancellationToken.None);

        // Act
        _queue.Enqueue("cam-1");
        _queue.Enqueue("cam-2");
        await probed.Task.ObservedAsync();
        await sut.StopAsync(CancellationToken.None);

        // Assert
        await _cameras.Received(1).GetByIdAsync("cam-2", Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task StopAsync_ShouldEndTheLoop_WhenTheHostShutsDown()
    {
        // Arrange
        var sut = CreateSut();
        await sut.StartAsync(CancellationToken.None);

        // Act
        await sut.StopWithinGuardAsync();

        // Assert
        Assert.True(sut.ExecuteTask!.IsCompleted);
        Assert.False(sut.ExecuteTask.IsFaulted);
    }
}
