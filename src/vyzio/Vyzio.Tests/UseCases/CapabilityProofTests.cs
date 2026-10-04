using NSubstitute;
using Vyzio.Application.UseCases.Cameras;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Tests.UseCases;

// The capability level: what a proof outcome makes of a capability whose protocol answered (ADR-66).
public class CapabilityProofTests
{
    private static readonly DateTimeOffset Confirmed = new(2026, 9, 1, 8, 0, 0, TimeSpan.Zero);

    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly ICameraCapabilityBindingRepository _bindings = Substitute.For<ICameraCapabilityBindingRepository>();
    private readonly ICapabilityProviderRegistry _registry = Substitute.For<ICapabilityProviderRegistry>();
    private readonly ICameraProtocolEndpointCache _endpointCache = Substitute.For<ICameraProtocolEndpointCache>();
    private readonly IPtzCapabilityProvider _ptz = Substitute.For<IPtzCapabilityProvider>();
    private readonly Camera _camera = new() { Id = "cam1", Slug = "cam1", FrigateCameraName = "cam1", DisplayName = "cam1", Host = "192.168.1.10" };

    public CapabilityProofTests()
    {
        _registry.ResolvePtz(Arg.Any<SupportedProtocol>()).Returns(_ptz);
        _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>()).Returns(_camera);
    }

    private CameraCapabilityBinding Ptz(SupportedProtocol protocol = SupportedProtocol.Dvrip, CapabilityStatus status = CapabilityStatus.Failed, DateTimeOffset? confirmedAt = null)
    {
        var binding = new CameraCapabilityBinding
        {
            CameraId = "cam1",
            Capability = CameraCapability.Ptz,
            Protocol = protocol,
            Status = status,
            ConfirmedAt = confirmedAt,
        };
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns(binding);
        return binding;
    }

    private void ProofIs(CapabilityProof proof)
        => _ptz.ProveAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>()).Returns(proof);

    private ProbeCameraCapabilityUseCase Probe(ICameraProtocolProbe? protocols = null)
        => CapabilityTestUseCases.Probe(_cameras, _bindings, _registry, _endpointCache, protocols);

    private static ICameraProtocolProbe SilentProtocol()
    {
        var probe = Substitute.For<ICameraProtocolProbe>();
        probe.ProbeAsync(Arg.Any<Camera>(), Arg.Any<SupportedProtocol>(), Arg.Any<CancellationToken>())
            .Returns(ProtocolAnswer.Unreachable("Dvrip: no answer on 192.168.1.10:34567 within 3 s."));
        return probe;
    }

    [Fact]
    public async Task ExecuteAsync_ShouldMarkTheCapabilityMissingWithTheCameraAnswer_WhenTheProtocolAnswersButTheCameraLacksTheCapability()
    {
        // Arrange
        var binding = Ptz(SupportedProtocol.Onvif);
        ProofIs(CapabilityProof.Missing("ONVIF: 192.168.1.10 carries no PTZ configuration on its first media profile."));

        // Act
        var result = await Probe().ExecuteAsync("cam1", CameraCapability.Ptz);

        // Assert
        Assert.Equal(CapabilityStatus.Missing, binding.Status);
        Assert.False(result!.Verified);
        Assert.Equal("ONVIF: 192.168.1.10 carries no PTZ configuration on its first media profile.", result.LastError);
        Assert.Equal(ProtocolStatus.Answers, _camera.Protocol(SupportedProtocol.Onvif)?.Status);
        Assert.False(_camera.PtzSupported);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldLeaveTheCapabilityToConfirm_WhenTheProtocolAnswersAndNoReadCanProveIt()
    {
        // Arrange
        var binding = Ptz();
        ProofIs(CapabilityProof.Unprovable());

        // Act
        var result = await Probe().ExecuteAsync("cam1", CameraCapability.Ptz);

        // Assert
        Assert.Equal(CapabilityStatus.ToConfirm, binding.Status);
        Assert.False(result!.Verified);
        Assert.Equal("to_confirm", result.Status);
        Assert.False(_camera.PtzSupported);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldVerifyAndShowThePtzPanel_WhenTheCameraProvesTheCapability()
    {
        // Arrange
        var binding = Ptz();
        ProofIs(CapabilityProof.Proven());

        // Act
        await Probe().ExecuteAsync("cam1", CameraCapability.Ptz);

        // Assert
        Assert.Equal(CapabilityStatus.Verified, binding.Status);
        Assert.True(_camera.PtzSupported);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldNeverAskForTheProof_WhenTheProtocolDoesNotAnswer()
    {
        // Arrange
        var binding = Ptz();

        // Act
        await Probe(SilentProtocol()).ExecuteAsync("cam1", CameraCapability.Ptz);

        // Assert
        Assert.Equal(CapabilityStatus.Failed, binding.Status);
        await _ptz.DidNotReceive().ProveAsync(Arg.Any<Camera>(), Arg.Any<CameraCapabilityBinding>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldStayVerified_WhenTheUserConfirmedItAndItIsStillUnprovable()
    {
        // Arrange
        var binding = Ptz(status: CapabilityStatus.Verified, confirmedAt: Confirmed);
        ProofIs(CapabilityProof.Unprovable());

        // Act
        await Probe().ExecuteAsync("cam1", CameraCapability.Ptz);

        // Assert
        Assert.Equal(CapabilityStatus.Verified, binding.Status);
        Assert.Equal(Confirmed, binding.ConfirmedAt);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldKeepTheUserConfirmation_WhenTheCameraStopsAnsweringForAWhile()
    {
        // Arrange
        var binding = Ptz(status: CapabilityStatus.Verified, confirmedAt: Confirmed);

        // Act
        await Probe(SilentProtocol()).ExecuteAsync("cam1", CameraCapability.Ptz);

        // Assert
        Assert.Equal(CapabilityStatus.Failed, binding.Status);
        Assert.Equal(Confirmed, binding.ConfirmedAt);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldReplaceTheUserConfirmationByTheProof_WhenTheCameraProvesItLater()
    {
        // Arrange
        var binding = Ptz(status: CapabilityStatus.Verified, confirmedAt: Confirmed);
        ProofIs(CapabilityProof.Proven());

        // Act
        await Probe().ExecuteAsync("cam1", CameraCapability.Ptz);

        // Assert
        Assert.Equal(CapabilityStatus.Verified, binding.Status);
        Assert.Null(binding.ConfirmedAt);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldOfferTheTryAgain_WhenTheUserAnsweredNoBefore()
    {
        // Arrange
        var binding = Ptz(status: CapabilityStatus.RejectedByUser);
        ProofIs(CapabilityProof.Unprovable());

        // Act
        await Probe().ExecuteAsync("cam1", CameraCapability.Ptz);

        // Assert
        Assert.Equal(CapabilityStatus.ToConfirm, binding.Status);
    }

    [Fact]
    public async Task ConfigureAsync_ShouldDropTheUserConfirmation_WhenTheUserMovesTheCapabilityToAnotherProtocol()
    {
        // Arrange
        _camera.EnsureProtocol(SupportedProtocol.V380);
        _registry.GetRegisteredProtocols(CameraCapability.Ptz).Returns([SupportedProtocol.Dvrip, SupportedProtocol.V380]);
        var binding = Ptz(status: CapabilityStatus.Verified, confirmedAt: Confirmed);
        ProofIs(CapabilityProof.Unprovable());
        var sut = new ConfigureCameraCapabilityUseCase(_cameras, _bindings, _registry, Substitute.For<IFrigateConfigApplier>(), Probe());

        // Act
        await sut.ExecuteAsync("cam1", new ConfigureCameraCapabilityRequest("ptz", "v380"));

        // Assert
        Assert.Null(binding.ConfirmedAt);
        Assert.Equal(CapabilityStatus.ToConfirm, binding.Status);
    }

    [Fact]
    public async Task ConfigureAsync_ShouldKeepTheUserConfirmation_WhenTheUserKeepsTheSameProtocol()
    {
        // Arrange
        _registry.GetRegisteredProtocols(CameraCapability.Ptz).Returns([SupportedProtocol.Dvrip]);
        var binding = Ptz(status: CapabilityStatus.Verified, confirmedAt: Confirmed);
        ProofIs(CapabilityProof.Unprovable());
        var sut = new ConfigureCameraCapabilityUseCase(_cameras, _bindings, _registry, Substitute.For<IFrigateConfigApplier>(), Probe());

        // Act
        await sut.ExecuteAsync("cam1", new ConfigureCameraCapabilityRequest("ptz", "dvrip"));

        // Assert
        Assert.Equal(Confirmed, binding.ConfirmedAt);
        Assert.Equal(CapabilityStatus.Verified, binding.Status);
    }
}

// Detection over the capability level: a proof first, then a capability to confirm (ADR-66 e).
public class CapabilityDetectionTests
{
    private readonly ICameraRepository _cameras = Substitute.For<ICameraRepository>();
    private readonly ICameraCapabilityBindingRepository _bindings = Substitute.For<ICameraCapabilityBindingRepository>();
    private readonly ICapabilityProviderRegistry _registry = Substitute.For<ICapabilityProviderRegistry>();
    private readonly IPtzCapabilityProvider _ptz = Substitute.For<IPtzCapabilityProvider>();
    private CameraCapabilityBinding? _stored;

    public CapabilityDetectionTests()
    {
        _registry.ResolvePtz(Arg.Any<SupportedProtocol>()).Returns(_ptz);
        _bindings.GetAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>()).Returns(_ => _stored);
        _bindings.When(b => b.SaveAsync(Arg.Is<CameraCapabilityBinding>(x => x.Capability == CameraCapability.Ptz), Arg.Any<CancellationToken>()))
            .Do(call => _stored = call.Arg<CameraCapabilityBinding>());
    }

    private void CameraIs(VendorFamily? family)
        => _cameras.GetByIdAsync("cam1", Arg.Any<CancellationToken>())
            .Returns(new Camera { Id = "cam1", Slug = "cam1", FrigateCameraName = "cam1", DisplayName = "cam1", Host = "h", VendorFamily = family });

    private void ProofOver(SupportedProtocol protocol, CapabilityProof proof)
        => _ptz.ProveAsync(Arg.Any<Camera>(), Arg.Is<CameraCapabilityBinding>(b => b.Protocol == protocol), Arg.Any<CancellationToken>()).Returns(proof);

    private Task DetectAsync()
        => CapabilityTestUseCases.Seed(_cameras, _bindings, _registry, Substitute.For<ICameraProtocolEndpointCache>()).ExecuteAsync("cam1");

    [Fact]
    public async Task ExecuteAsync_ShouldKeepTheProtocolWhereItIsToConfirm_WhenNoCandidateProvesIt()
    {
        // Arrange
        CameraIs(VendorFamily.Icsee);
        ProofOver(SupportedProtocol.Onvif, CapabilityProof.Missing("ONVIF: h carries no PTZ configuration on its first media profile."));
        ProofOver(SupportedProtocol.Dvrip, CapabilityProof.Unprovable());

        // Act
        await DetectAsync();

        // Assert
        Assert.Equal(SupportedProtocol.Dvrip, _stored!.Protocol);
        Assert.Equal(CapabilityStatus.ToConfirm, _stored.Status);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldPreferALaterProof_WhenAnEarlierCandidateLeavesItToConfirm()
    {
        // Arrange
        CameraIs(VendorFamily.Icsee);
        ProofOver(SupportedProtocol.Onvif, CapabilityProof.Unprovable());
        ProofOver(SupportedProtocol.Dvrip, CapabilityProof.Proven());

        // Act
        await DetectAsync();

        // Assert
        Assert.Equal(SupportedProtocol.Dvrip, _stored!.Protocol);
        Assert.Equal(CapabilityStatus.Verified, _stored.Status);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldComeBackToTheFirstCandidateToConfirm_WhenTheLastOneShowsTheCapabilityMissing()
    {
        // Arrange
        CameraIs(VendorFamily.Icsee);
        ProofOver(SupportedProtocol.Onvif, CapabilityProof.Unprovable());
        ProofOver(SupportedProtocol.Dvrip, CapabilityProof.Missing("DVRIP: no PTZ."));

        // Act
        await DetectAsync();

        // Assert
        Assert.Equal(SupportedProtocol.Onvif, _stored!.Protocol);
        Assert.Equal(CapabilityStatus.ToConfirm, _stored.Status);
    }

    [Fact]
    public async Task ExecuteAsync_ShouldDropACapabilityLeftToConfirm_WhenTheCameraIsUnrecognised()
    {
        // Arrange
        CameraIs(null);
        _registry.GetRegisteredProtocols(CameraCapability.Ptz).Returns([SupportedProtocol.V380]);
        ProofOver(SupportedProtocol.V380, CapabilityProof.Unprovable());

        // Act
        await DetectAsync();

        // Assert
        await _bindings.Received(1).DeleteAsync("cam1", CameraCapability.Ptz, Arg.Any<CancellationToken>());
    }
}
