using NSubstitute;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Tests.UseCases;

// Builds the capability use cases over substitutes, every protocol answering unless a test says otherwise.
internal static class CapabilityTestUseCases
{
    public static ICameraProtocolProbe AnsweringProbe()
    {
        var probe = Substitute.For<ICameraProtocolProbe>();
        probe.ProbeAsync(Arg.Any<Camera>(), Arg.Any<SupportedProtocol>(), Arg.Any<CancellationToken>())
            .Returns(ProtocolAnswer.Answers());
        return probe;
    }

    // The two stream transports, as the real registry lists them.
    public static ICapabilityProviderRegistry StreamRegistry()
    {
        var registry = Substitute.For<ICapabilityProviderRegistry>();
        registry.GetRegisteredProtocols(CameraCapability.Stream).Returns([SupportedProtocol.Rtsp, SupportedProtocol.Dvrip]);
        return registry;
    }

    public static ProbeCameraCapabilityUseCase Probe(
        ICameraRepository cameras,
        ICameraCapabilityBindingRepository bindings,
        ICapabilityProviderRegistry registry,
        ICameraProtocolEndpointCache endpointCache,
        ICameraProtocolProbe? protocols = null,
        ICameraVerifier? verifier = null)
    {
        var check = new CameraProtocolCheck(protocols ?? AnsweringProbe(), TimeProvider.System);
        return new(
            cameras,
            bindings,
            registry,
            endpointCache,
            check,
            new VerifyCameraUseCase(cameras, bindings, verifier ?? OnlineVerifier(), NothingEnumerated(), check, TimeProvider.System));
    }

    private static ICameraVerifier OnlineVerifier()
    {
        var verifier = Substitute.For<ICameraVerifier>();
        verifier.VerifyAsync(Arg.Any<Camera>(), Arg.Any<CameraStream?>(), Arg.Any<CancellationToken>())
            .Returns(new CameraVerificationResult(true, true, "online", "Verified.", DateTimeOffset.UnixEpoch, DateTimeOffset.UnixEpoch));
        return verifier;
    }

    public static ICameraStreamEnumerator NothingEnumerated()
    {
        var enumerator = Substitute.For<ICameraStreamEnumerator>();
        enumerator.EnumerateAsync(Arg.Any<Camera>(), Arg.Any<SupportedProtocol>(), Arg.Any<CancellationToken>()).Returns([]);
        return enumerator;
    }

    // A camera that lists one stream, so a stream can be laid out over RTSP (ADR-65 e).
    public static ICameraStreamEnumerator ListsOneStream(string path = "/stream1")
    {
        var enumerator = Substitute.For<ICameraStreamEnumerator>();
        enumerator.EnumerateAsync(Arg.Any<Camera>(), Arg.Any<SupportedProtocol>(), Arg.Any<CancellationToken>())
            .Returns([new EnumeratedScene("scene", [new EnumeratedStream(path, 1920, 1080, 25)])]);
        return enumerator;
    }

    public static SeedAndProbePresetsUseCase Seed(
        ICameraRepository cameras,
        ICameraCapabilityBindingRepository bindings,
        ICapabilityProviderRegistry registry,
        ICameraProtocolEndpointCache endpointCache,
        ICameraProtocolProbe? protocols = null,
        ICameraVerifier? verifier = null,
        ICameraStreamEnumerator? enumerator = null)
    {
        var answers = protocols ?? AnsweringProbe();
        return new(
            cameras,
            bindings,
            Probe(cameras, bindings, registry, endpointCache, answers, verifier),
            registry,
            endpointCache,
            new DetectionPlan(registry),
            Search(registry, answers),
            Substitute.For<IFrigateConfigApplier>(),
            enumerator ?? ListsOneStream(),
            TimeProvider.System);
    }

    public static CameraProtocolSearch Search(ICapabilityProviderRegistry registry, ICameraProtocolProbe? protocols = null)
        => new(new DetectionPlan(registry), new CameraProtocolCheck(protocols ?? AnsweringProbe(), TimeProvider.System));
}
