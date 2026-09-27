using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Cameras;

public sealed record DetectionStep(CameraCapability Capability, IReadOnlyList<SupportedProtocol> Protocols, bool DeleteIfUnverified);

// What detection tries on a camera: its vendor's preset, otherwise every registered provider (ADR-28).
public sealed class DetectionPlan(ICapabilityProviderRegistry registry)
{
    private static readonly CameraCapability[] BlindProbeCapabilities =
        [CameraCapability.Ptz, CameraCapability.HardwarePrivacy, CameraCapability.ImageSettings];

    // A preset's guess is kept unverified with its reason; a blind guess that fails is not worth a card.
    public IReadOnlyList<DetectionStep> StepsFor(Camera camera)
    {
        var preset = camera.VendorFamily is { } vf ? VendorCapabilityPresets.GetByVendorFamily(vf) : null;
        return preset is not null
            ? preset.DefaultBindings.Select(b => new DetectionStep(b.Capability, b.Protocols, DeleteIfUnverified: false)).ToList()
            : BlindProbeCapabilities
                .Select(capability => new DetectionStep(capability, registry.GetRegisteredProtocols(capability), DeleteIfUnverified: true))
                .Where(step => step.Protocols.Count > 0)
                .ToList();
    }

    // The stream's protocols first, in their order, then every protocol a step names.
    public IReadOnlyList<SupportedProtocol> CandidateProtocols(Camera camera)
        => registry.GetRegisteredProtocols(CameraCapability.Stream)
            .Concat(StepsFor(camera).SelectMany(step => step.Protocols))
            .Distinct()
            .ToList();
}

// Level 2 alone: every candidate protocol and every protocol the camera has is checked once (ADR-61).
public sealed class CameraProtocolSearch(DetectionPlan plan, CameraProtocolCheck protocolCheck)
{
    // Writes on the entity only; the caller drops the tries that could not be reached.
    public async Task RunAsync(Camera camera, ProtocolCheckRun run, CancellationToken ct)
    {
        var present = camera.Protocols.Select(entry => entry.Protocol).ToList();
        foreach (var protocol in plan.CandidateProtocols(camera).Concat(present).Distinct())
            await protocolCheck.CheckAsync(camera, protocol, run, ct);
    }
}

// "Rechercher les protocoles": the protocol level only, no capability is bound or tested (ADR-61 d).
public sealed class SearchCameraProtocolsUseCase(
    ICameraRepository cameras,
    ICameraProtocolEndpointCache endpointCache,
    CameraProtocolSearch search,
    GetCameraProtocolsUseCase list)
{
    public async Task<IReadOnlyList<CameraProtocolDto>?> ExecuteAsync(string cameraId, CancellationToken ct = default)
    {
        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null) return null;

        // Looking again: the ONVIF address is asked anew, never trusted from before (ADR-56).
        CameraEndpointForgetting.Forget(camera, endpointCache);
        var present = camera.Protocols.Select(entry => entry.Protocol).ToHashSet();
        await search.RunAsync(camera, new ProtocolCheckRun(), ct);

        // A protocol the camera already had keeps its row, whatever it answered; a silent try is not listed.
        var silentTries = camera.Protocols
            .Where(entry => !present.Contains(entry.Protocol) && entry.Status == ProtocolStatus.Unreachable)
            .ToList();
        foreach (var entry in silentTries) camera.Protocols.Remove(entry);
        await cameras.UpdateAsync(camera, ct);
        return await list.ExecuteAsync(cameraId, ct);
    }
}
