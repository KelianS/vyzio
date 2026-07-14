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
    bool IsConfigured)
{
    public static CameraCapabilityBindingDto From(CameraCapabilityBinding binding, bool isPreset = false) => new(
        SnakeCaseEnum.ToSnakeCase(binding.Capability),
        SnakeCaseEnum.ToSnakeCase(binding.Protocol),
        binding.ConfigJson,
        binding.Verified,
        binding.VerifiedAt,
        binding.LastError,
        IsPreset: isPreset,
        IsConfigured: true);

    public static CameraCapabilityBindingDto FromPreset(CameraCapability capability, SupportedProtocol protocol) => new(
        SnakeCaseEnum.ToSnakeCase(capability),
        SnakeCaseEnum.ToSnakeCase(protocol),
        ConfigJson: null,
        Verified: false,
        VerifiedAt: null,
        LastError: null,
        IsPreset: true,
        IsConfigured: false);
}

// Executes a real connectivity/capability check (ADR-22) — Verified is only ever set as a
// result of this call, never declaratively.
public sealed class ProbeCameraCapabilityUseCase(
    ICameraRepository cameras,
    ICameraCapabilityBindingRepository bindings,
    ICapabilityProviderRegistry registry)
{
    public async Task<CameraCapabilityBindingDto?> ExecuteAsync(string cameraId, CameraCapability capability, CancellationToken ct = default)
    {
        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null) return null;

        var binding = await bindings.GetAsync(cameraId, capability, ct);
        if (binding is null) return null;

        bool verified;
        string? error = null;
        try
        {
            verified = capability switch
            {
                CameraCapability.Ptz => await registry.ResolvePtz(binding.Protocol).ProbeAsync(camera, binding, ct),
                CameraCapability.HardwarePrivacy => await registry.ResolvePrivacy(binding.Protocol).ProbeAsync(camera, binding, ct),
                CameraCapability.ImageSettings => await registry.ResolveImageSettings(binding.Protocol).ProbeAsync(camera, binding, ct),
                _ => false,
            };
        }
        catch (Exception ex)
        {
            verified = false;
            error = ex.Message;
        }

        binding.Verified = verified;
        binding.VerifiedAt = DateTimeOffset.UtcNow;
        binding.LastError = verified ? null : error;
        await bindings.SaveAsync(binding, ct);

        // A2: PTZ probe success → activate the PTZ panel without manual intervention.
        if (capability == CameraCapability.Ptz && verified && !camera.PtzSupported)
        {
            camera.PtzSupported = true;
            await cameras.UpdateAsync(camera, ct);
        }

        return CameraCapabilityBindingDto.From(binding);
    }
}

public sealed record ConfigureCameraCapabilityRequest(string Capability, string Protocol, string? ConfigJson);

// Manual onboarding for non-listed cameras, or manual override on a recognized vendor
// (SPECS §2.3): creates/updates a binding then immediately probes it — a binding is never
// offered as activatable on declaration alone. Marks the binding ManuallyConfigured so
// SeedAndProbePresetsUseCase never silently reverts this choice back to the vendor preset (ADR-28).
public sealed class ConfigureCameraCapabilityUseCase(
    ICameraRepository cameras,
    ICameraCapabilityBindingRepository bindings,
    ProbeCameraCapabilityUseCase probe)
{
    public async Task<CameraCapabilityBindingDto?> ExecuteAsync(string cameraId, ConfigureCameraCapabilityRequest request, CancellationToken ct = default)
    {
        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null) return null;

        if (!SnakeCaseEnum.TryFromSnakeCase<CameraCapability>(request.Capability, out var capability))
            throw new ArgumentException($"Invalid capability '{request.Capability}'.");
        if (!SnakeCaseEnum.TryFromSnakeCase<SupportedProtocol>(request.Protocol, out var protocol))
            throw new ArgumentException($"Invalid protocol '{request.Protocol}'.");

        var binding = await bindings.GetAsync(cameraId, capability, ct) ?? new CameraCapabilityBinding
        {
            CameraId = cameraId,
            Capability = capability,
        };

        binding.Protocol = protocol;
        binding.ConfigJson = request.ConfigJson;
        binding.Verified = false;
        binding.LastError = null;
        binding.ManuallyConfigured = true;

        await bindings.SaveAsync(binding, ct);

        return await probe.ExecuteAsync(cameraId, capability, ct);
    }
}

public sealed class GetCameraCapabilitiesUseCase(ICameraRepository cameras, ICameraCapabilityBindingRepository bindings)
{
    public async Task<IReadOnlyList<CameraCapabilityBindingDto>?> ExecuteAsync(string cameraId, CancellationToken ct = default)
    {
        var camera = await cameras.GetByIdAsync(cameraId, ct);
        if (camera is null) return null;

        var dbBindings = await bindings.GetByCameraAsync(cameraId, ct);
        var preset = camera.VendorFamily is { } vf ? VendorCapabilityPresets.GetByVendorFamily(vf) : null;

        var result = new List<CameraCapabilityBindingDto>();

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
        var presetCaps = preset?.DefaultBindings.Select(b => b.Capability).ToHashSet() ?? [];
        foreach (var binding in dbBindings)
        {
            if (!presetCaps.Contains(binding.Capability))
                result.Add(CameraCapabilityBindingDto.From(binding, isPreset: false));
        }

        return result;
    }
}
