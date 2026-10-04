using Vyzio.Core.Common;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Cameras;

public sealed record CameraCapabilityBindingDto(
    string Capability,
    string Protocol,
    string? ConfigJson,
    bool Verified,
    DateTimeOffset? VerifiedAt,
    string? LastError,
    bool IsPreset,
    bool IsConfigured,
    string Status,
    bool? PanInverted = null,
    bool? NativePositions = null,
    DateTimeOffset? ConfirmedAt = null)
{
    public static CameraCapabilityBindingDto From(CameraCapabilityBinding binding, bool isPreset = false) => new(
        SnakeCaseEnum.ToSnakeCase(binding.Capability),
        SnakeCaseEnum.ToSnakeCase(binding.Protocol),
        binding.ConfigJson,
        binding.Verified,
        binding.VerifiedAt,
        binding.LastError,
        IsPreset: isPreset,
        IsConfigured: true,
        // Verified says whether it is usable, Status why (ADR-66).
        Status: SnakeCaseEnum.ToSnakeCase(binding.Status),
        // Only a PTZ binding has a direction to swap (SPECS 11).
        PanInverted: binding.Capability == CameraCapability.Ptz
            ? BindingConfig.ReadBool(binding.ConfigJson, BindingConfig.PanInverted)
            : null,
        // Whether the camera keeps the positions itself or Vyzio counts them (ADR-64).
        NativePositions: binding.Capability == CameraCapability.Ptz ? PtzPositionTier.IsNative(binding) : null,
        ConfirmedAt: binding.ConfirmedAt);

    public static CameraCapabilityBindingDto FromPreset(CameraCapability capability, SupportedProtocol protocol) => new(
        SnakeCaseEnum.ToSnakeCase(capability),
        SnakeCaseEnum.ToSnakeCase(protocol),
        ConfigJson: null,
        Verified: false,
        VerifiedAt: null,
        LastError: null,
        IsPreset: true,
        IsConfigured: false,
        Status: SnakeCaseEnum.ToSnakeCase(CapabilityStatus.Failed));
}

// Executes a real check (ADR-22): the protocol answers, then the capability's read-only proof (ADR-66).
public sealed class ProbeCameraCapabilityUseCase(
    ICameraRepository cameras,
    ICameraCapabilityBindingRepository bindings,
    ICapabilityProviderRegistry registry,
    ICameraProtocolEndpointCache endpointCache,
    CameraProtocolCheck protocolCheck,
    VerifyCameraUseCase verifyStream)
{
    // rediscoverEndpoints: resolve where the camera answers from scratch; the cascade forgets once itself (ADR-56).
    // run: the protocol answers already heard in this gesture, so each protocol is asked once (ADR-61).
    public async Task<CameraCapabilityBindingDto?> ExecuteAsync(
        string cameraId,
        CameraCapability capability,
        bool rediscoverEndpoints = false,
        ProtocolCheckRun? run = null,
        CancellationToken ct = default)
    {
        // The stream verification is the stream capability's probe (ADR-61).
        if (capability == CameraCapability.Stream)
        {
            if (await verifyStream.ExecuteAsync(cameraId, run, ct) is null) return null;
            var stream = await bindings.GetAsync(cameraId, capability, ct);
            return stream is null ? null : CameraCapabilityBindingDto.From(stream);
        }

        return await ProbeThroughProtocolAsync(cameraId, capability, rediscoverEndpoints, run, ct);
    }

    private async Task<CameraCapabilityBindingDto?> ProbeThroughProtocolAsync(
        string cameraId, CameraCapability capability, bool rediscoverEndpoints, ProtocolCheckRun? run, CancellationToken ct)
    {
        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null) return null;

        if (rediscoverEndpoints) CameraEndpointForgetting.Forget(camera, endpointCache);

        var binding = await bindings.GetAsync(cameraId, capability, ct);
        if (binding is null)
        {
            // A forgotten address is saved even when there is nothing to probe (ADR-56).
            if (rediscoverEndpoints) await cameras.UpdateAsync(camera, ct);
            return null;
        }

        var protocol = await protocolCheck.CheckAsync(camera, binding.Protocol, run, ct);
        if (!protocol.Answers)
        {
            // A protocol that is silent or refuses the account fails the capability with its own reason (ADR-61).
            CapabilityVerdict.Fail(binding, protocol.LastError);
        }
        else
        {
            try
            {
                var proof = capability switch
                {
                    CameraCapability.Ptz => await registry.ResolvePtz(binding.Protocol).ProveAsync(camera, binding, ct),
                    CameraCapability.HardwarePrivacy => await registry.ResolvePrivacy(binding.Protocol).ProveAsync(camera, binding, ct),
                    CameraCapability.ImageSettings => await registry.ResolveImageSettings(binding.Protocol).ProveAsync(camera, binding, ct),
                    _ => throw new ArgumentOutOfRangeException(nameof(capability), capability, "No proof for this capability."),
                };
                CapabilityVerdict.Apply(binding, proof);
            }
            catch (Exception ex)
            {
                CapabilityVerdict.Fail(binding, ex.Message);
            }
        }

        binding.VerifiedAt = DateTimeOffset.UtcNow;
        await bindings.SaveAsync(binding, ct);

        CapabilityVerdict.ShowPtzPanel(camera, binding);

        // The protocol row and what a provider found (ONVIF address, V380 device id) are saved with the camera.
        await cameras.UpdateAsync(camera, ct);

        return CameraCapabilityBindingDto.From(binding);
    }
}

// Drops both halves of where a camera answers, its row and the process cache, never one alone (ADR-56).
internal static class CameraEndpointForgetting
{
    public static void Forget(Camera camera, ICameraProtocolEndpointCache cache)
    {
        camera.ClearProtocolEndpoints();
        cache.Forget(camera.Id);
    }
}

// StreamPath: the first stream's path over RTSP, typed when the camera lists no stream (ADR-65 e).
public sealed record ConfigureCameraCapabilityRequest(string Capability, string Protocol, string? StreamPath = null);

// A capability goes through a protocol the camera has; another one is added first (ADR-61 d).
public sealed class ProtocolNotOnCameraException(SupportedProtocol protocol)
    : Exception($"The camera has no {protocol} protocol: add it first.")
{
    public SupportedProtocol Protocol { get; } = protocol;
}

// Manual onboarding for non-listed cameras, or manual override on a recognized vendor
// (SPECS §2.3): creates/updates a binding then immediately probes it — a binding is never
// offered as activatable on declaration alone. Marks the binding ManuallyConfigured so
// SeedAndProbePresetsUseCase never silently reverts this choice back to the vendor preset (ADR-28).
// One of the camera's protocols, answering or not: a sleeping camera stays configurable (ADR-61 d).
public sealed class ConfigureCameraCapabilityUseCase(
    ICameraRepository cameras,
    ICameraCapabilityBindingRepository bindings,
    ICapabilityProviderRegistry registry,
    IFrigateConfigApplier frigateConfigApplier,
    ProbeCameraCapabilityUseCase probe,
    ICameraStreamEnumerator streamEnumerator,
    TimeProvider time)
{
    public async Task<CameraCapabilityBindingDto?> ExecuteAsync(string cameraId, ConfigureCameraCapabilityRequest request, CancellationToken ct = default)
    {
        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null) return null;

        if (!SnakeCaseEnum.TryFromSnakeCase<CameraCapability>(request.Capability, out var capability))
            throw new ArgumentException($"Invalid capability '{request.Capability}'.");
        if (!SnakeCaseEnum.TryFromSnakeCase<SupportedProtocol>(request.Protocol, out var protocol))
            throw new ArgumentException($"Invalid protocol '{request.Protocol}'.");
        if (!registry.GetRegisteredProtocols(capability).Contains(protocol))
            throw new ArgumentException($"No {request.Capability} provider speaks '{request.Protocol}'.");

        var existing = await bindings.GetAsync(cameraId, capability, ct);
        var protocolChanged = existing?.Protocol != protocol;
        if (protocolChanged && camera.Protocol(protocol) is null)
            throw new ProtocolNotOnCameraException(protocol);
        var binding = existing ?? new CameraCapabilityBinding
        {
            CameraId = cameraId,
            Capability = capability,
        };

        // A new stream protocol lays the streams out again over it; nothing is applied without them (ADR-65 e).
        if (capability == CameraCapability.Stream && protocolChanged
            && !await StreamLayout.TryLayOutAsync(camera, binding, protocol, request.StreamPath, streamEnumerator, time, ct))
            throw new StreamPathRequiredException();

        // The user's confirmation held for the former protocol only (ADR-66).
        CapabilityVerdict.Reset(binding, protocol);
        // The swap is the user's; what the former protocol found about the camera (native presets) is not.
        binding.ConfigJson = BindingConfig.Carry(binding.ConfigJson, null, BindingConfig.PanInverted);
        binding.ManuallyConfigured = true;

        await bindings.SaveAsync(binding, ct);

        var streamMoved = capability == CameraCapability.Stream && protocolChanged;
        if (streamMoved) CameraConnectionChange.Apply(camera);
        await cameras.UpdateAsync(camera, ct);

        var result = await probe.ExecuteAsync(cameraId, capability, ct: ct);
        if (streamMoved) await SurveillanceConfig.WriteAsync(cameras, frigateConfigApplier, ct);
        return result;
    }
}

// Removes a capability binding entirely (SPECS §2.3) — used when a binding no longer applies
// (e.g. a manually-added or now-unsupported capability that keeps surfacing a stale error) and
// there is no simple on/off flag for it (unlike PTZ's Camera.PtzSupported). The capability then
// reverts to "available" and can be reconfigured via the manual "+" form.
public sealed class RemoveCameraCapabilityUseCase(ICameraRepository cameras, ICameraCapabilityBindingRepository bindings)
{
    public async Task<bool> ExecuteAsync(string cameraId, CameraCapability capability, CancellationToken ct = default)
    {
        // A camera without its stream has nothing to watch: the stream changes protocol, it is never removed (ADR-61).
        if (capability == CameraCapability.Stream)
            throw new ArgumentException("The video stream cannot be removed; choose another protocol instead.");

        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null) return false;

        var binding = await bindings.GetAsync(cameraId, capability, ct);
        if (binding is null) return false;

        await bindings.DeleteAsync(cameraId, capability, ct);
        return true;
    }
}

public sealed class GetCameraCapabilitiesUseCase(
    ICameraRepository cameras,
    ICameraCapabilityBindingRepository bindings,
    ICapabilityProviderRegistry registry)
{
    public async Task<IReadOnlyList<CameraCapabilityBindingDto>?> ExecuteAsync(string cameraId, CancellationToken ct = default)
    {
        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null) return null;

        var dbBindings = await bindings.GetByCameraAsync(cameraId, ct);
        var preset = camera.VendorFamily is { } vf ? VendorCapabilityPresets.GetByVendorFamily(vf) : null;

        // The stream first, every other capability depends on it; unchosen, it reads "to configure" (ADR-61).
        var stream = dbBindings.FirstOrDefault(b => b.Capability == CameraCapability.Stream);
        var result = new List<CameraCapabilityBindingDto>
        {
            stream is not null
                ? CameraCapabilityBindingDto.From(stream)
                : CameraCapabilityBindingDto.FromPreset(CameraCapability.Stream, registry.GetRegisteredProtocols(CameraCapability.Stream)[0]),
        };

        if (preset is not null)
        {
            // Preset capabilities first — existing binding if available, synthetic suggestion otherwise
            // (first candidate protocol — the one SeedAndProbePresetsUseCase tries first, ADR-28).
            foreach (var (capability, protocols) in preset.DefaultBindings)
            {
                var binding = dbBindings.FirstOrDefault(b => b.Capability == capability);
                result.Add(binding is not null
                    ? CameraCapabilityBindingDto.From(binding, isPreset: true)
                    : CameraCapabilityBindingDto.FromPreset(capability, protocols[0]));
            }
        }

        // Non-preset bindings (manually added on unlisted cameras).
        var listed = preset?.DefaultBindings.Select(b => b.Capability).ToHashSet() ?? [];
        listed.Add(CameraCapability.Stream);
        foreach (var binding in dbBindings)
        {
            if (!listed.Contains(binding.Capability))
                result.Add(CameraCapabilityBindingDto.From(binding));
        }

        return result;
    }
}
