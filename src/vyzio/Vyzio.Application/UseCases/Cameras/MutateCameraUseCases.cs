using System.Text;
using Vyzio.Application.DTOs.Cameras;
using Vyzio.Core.Common;
using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Cameras;

public sealed class DiscoverCamerasUseCase(ICameraDiscoveryService discoveryService, ICameraRepository cameras)
{
    public async Task<IReadOnlyList<DiscoveredCameraDto>> ExecuteAsync(DiscoverCamerasRequest? request = null, CancellationToken ct = default)
    {
        var target = request?.ToTarget();
        var candidates = await discoveryService.DiscoverAsync(target, ct);
        var configuredEndpoints = (await cameras.GetAllAsync(ct))
            .Where(camera => camera.StreamBinding is not null)
            .Select(camera => BuildEndpointKey(camera.Host, camera.PortOf(camera.StreamBinding!.Protocol)))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        return candidates
            .Where(candidate => target is not null || !configuredEndpoints.Contains(BuildEndpointKey(candidate.Host, candidate.Port)))
            .Select(DiscoveredCameraDto.From)
            .ToList();
    }

    private static string BuildEndpointKey(string host, int port)
        => $"{host.Trim().ToLowerInvariant()}:{port}";
}

public sealed class GetVendorAssistanceUseCase(IVendorAssistanceService vendorAssistanceService)
{
    public async Task<VendorAssistanceDto?> ExecuteAsync(VendorAssistanceRequestDto request, CancellationToken ct = default)
    {
        var documentation = await vendorAssistanceService.GetAssistanceAsync(request.VendorFamily, request.StreamPath, request.Connected, ct);
        return VendorAssistanceDto.From(documentation);
    }
}

public sealed class CreateCameraUseCase(
    ICameraRepository cameras,
    ICameraCapabilityOnboardingQueue onboardingQueue,
    IFrigateConfigApplier frigateConfigApplier,
    ICapabilityProviderRegistry registry)
{
    public async Task<CameraDto> ExecuteAsync(CreateCameraRequest request, CancellationToken ct = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(request.DisplayName);
        ArgumentException.ThrowIfNullOrWhiteSpace(request.Host);

        var baseSlug = CameraDraftFactory.Slugify(request.DisplayName);
        var slug = await EnsureUniqueSlugAsync(baseSlug, ct);

        var camera = CameraDraftFactory.Build(request, slug, registry.GetRegisteredProtocols(CameraCapability.Stream));

        await cameras.AddAsync(camera, ct);

        // Kick off background capability probe (A1 + A3): seeds preset bindings and probes each
        // one so the capability section is pre-populated when the user opens the camera detail.
        onboardingQueue.Enqueue(camera.Id);

        // A new camera is something the surveillance has not taken up yet: without this the restart
        // trigger would stay hidden, and its absence claims everything saved is in service (ADR-44).
        await SurveillanceConfig.WriteAsync(cameras, frigateConfigApplier, ct);

        return CameraDto.From(camera);
    }

    private async Task<string> EnsureUniqueSlugAsync(string baseSlug, CancellationToken ct)
    {
        var slug = baseSlug;
        var suffix = 2;

        while (await cameras.GetBySlugAsync(slug, ct) is not null)
        {
            slug = $"{baseSlug}-{suffix}";
            suffix++;
        }

        return slug;
    }

}

public sealed class VerifyDraftCameraUseCase(ICameraVerifier verifier, CameraProtocolCheck protocolCheck, ICapabilityProviderRegistry registry)
{
    public async Task<CameraStatusDto> ExecuteAsync(CreateCameraRequest request, CancellationToken ct = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(request.DisplayName);
        ArgumentException.ThrowIfNullOrWhiteSpace(request.Host);

        var camera = CameraDraftFactory.Build(request, "draft-camera", registry.GetRegisteredProtocols(CameraCapability.Stream));
        camera.Id = "draft-camera";

        var (result, _) = await StreamVerification.RunAsync(camera, protocolCheck, verifier, run: null, ct);
        camera.Status = result.Status;
        camera.LastReachabilityCheckAt = result.CheckedAt;
        camera.LastSuccessfulFrameAt = result.LastSuccessfulFrameAt;
        camera.UpdatedAt = DateTimeOffset.UtcNow;

        return CameraStatusDto.From(camera, result.Guidance);
    }
}

public sealed class VerifyCameraUseCase(
    ICameraRepository cameras,
    ICameraCapabilityBindingRepository bindings,
    ICameraVerifier verifier,
    ICameraStreamEnumerator streamEnumerator,
    CameraProtocolCheck protocolCheck)
{
    // run: the protocol answers already heard in this gesture, so detection asks the stream's protocol once (ADR-61).
    public async Task<CameraStatusDto?> ExecuteAsync(string id, ProtocolCheckRun? run = null, CancellationToken ct = default)
    {
        var camera = await cameras.GetByIdAsync(id, ct);
        if (camera is null)
        {
            return null;
        }

        var (result, detail) = await StreamVerification.RunAsync(camera, protocolCheck, verifier, run, ct);
        camera.Status = result.Status;
        camera.LastReachabilityCheckAt = result.CheckedAt;
        camera.LastSuccessfulFrameAt = result.LastSuccessfulFrameAt;
        camera.UpdatedAt = DateTimeOffset.UtcNow;

        // The verification is the stream capability's probe; its reason is kept like any capability's (ADR-61).
        var stream = await bindings.GetAsync(camera.Id, CameraCapability.Stream, ct);
        if (stream is not null)
        {
            CapabilityVerdict.Stream(stream, result.PreviewAvailable, detail);
            stream.VerifiedAt = result.CheckedAt;
            await bindings.SaveAsync(stream, ct);
        }

        // Verification is the one moment the camera is known reachable, so it is where Vyzio asks
        // what it actually serves (ADR-38) — no extra user action, no extra round of connections.
        if (result.Connected)
        {
            await SyncStreamsAsync(camera, ct);
        }

        await cameras.UpdateAsync(camera, ct);
        return CameraStatusDto.From(camera, result.Guidance);
    }

    private async Task SyncStreamsAsync(Camera camera, CancellationToken ct)
    {
        var scenes = await streamEnumerator.EnumerateAsync(camera, ct);

        // Only the scene this camera films is applied. Other scenes mean a multi-lens device, whose
        // extra lenses become cameras of their own through onboarding, never streams here (ADR-38).
        var scene = scenes.Count > 0 ? scenes[0] : null;
        if (scene is null || scene.Streams.Count == 0)
        {
            return;
        }

        for (var ordinal = 0; ordinal < scene.Streams.Count; ordinal++)
        {
            var enumerated = scene.Streams[ordinal];
            var existing = camera.Streams.FirstOrDefault(stream => stream.Ordinal == ordinal);
            if (existing is null)
            {
                camera.Streams.Add(new CameraStream
                {
                    CameraId = camera.Id,
                    Ordinal = ordinal,
                    Path = enumerated.Path,
                    Width = enumerated.Width,
                    Height = enumerated.Height,
                    Fps = enumerated.Fps,
                });
                continue;
            }

            // The main path is what the user entered and verified — enumeration refreshes what the
            // camera reports about it, never overwrites the address that is known to work.
            //
            // Its size, however, is only adopted when the two addresses agree. Vendors alias their
            // streams (a camera answering on /stream1 advertises /live/ch00_1 and /live/ch00_0 at
            // different sizes), so attaching the advertised resolution to a path we cannot match
            // would claim a size the stream does not have — and make Frigate upscale, which is the
            // very waste this work removes (ADR-38).
            var sizeApplies = ordinal != 0 || PathsMatch(existing.Path, enumerated.Path);

            if (ordinal != 0)
            {
                existing.Path = enumerated.Path;
            }

            existing.Width = sizeApplies ? enumerated.Width : null;
            existing.Height = sizeApplies ? enumerated.Height : null;
            existing.Fps = sizeApplies ? enumerated.Fps : null;
            existing.UpdatedAt = DateTimeOffset.UtcNow;
        }

        // A quality tier the camera no longer reports must not stay selectable — it would resolve to
        // a stream that does not exist.
        PruneStaleStreams(camera, scene);
    }

    private static bool PathsMatch(string? left, string? right)
        => string.Equals(left?.TrimStart('/'), right?.TrimStart('/'), StringComparison.OrdinalIgnoreCase);

    // A rank the camera no longer reports must not stay selectable — it would resolve to a stream
    // that does not exist. Rank 0 is never dropped: it holds the address the user verified.
    private static void PruneStaleStreams(Camera camera, EnumeratedScene scene)
    {
        foreach (var stale in camera.Streams.Where(stream => stream.Ordinal >= scene.Streams.Count).ToList())
        {
            if (stale.Ordinal == 0) continue;
            if (camera.DetectStreamId == stale.Id) camera.DetectStreamId = null;
            camera.Streams.Remove(stale);
        }
    }
}

public sealed class UpdateCameraUseCase(ICameraRepository cameras, IFrigateConfigApplier frigateConfigApplier)
{
    public async Task<CameraDto?> ExecuteAsync(string id, UpdateCameraRequest request, CancellationToken ct = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(request.DisplayName);
        ArgumentException.ThrowIfNullOrWhiteSpace(request.Host);

        var camera = await cameras.GetByIdAsync(id, ct);
        if (camera is null)
        {
            return null;
        }

        var normalizedHost = request.Host.Trim();
        var normalizedUsername = CameraDraftFactory.NormalizeOptional(request.Username);
        var normalizedVendorFamily = SnakeCaseEnum.TryFromSnakeCase<VendorFamily>(request.VendorFamily, out var parsedVendorFamily)
            ? parsedVendorFamily
            : (VendorFamily?)null;
        var normalizedSourceType = string.IsNullOrWhiteSpace(request.SourceType) ? camera.SourceType : request.SourceType.Trim();
        var normalizedPassword = request.Password is null ? null : CameraDraftFactory.NormalizeOptional(request.Password);

        var connectivityChanged = !string.Equals(camera.Host, normalizedHost, StringComparison.OrdinalIgnoreCase)
            || !string.Equals(camera.Username, normalizedUsername, StringComparison.Ordinal)
            || !string.Equals(camera.SourceType, normalizedSourceType, StringComparison.Ordinal)
            || camera.VendorFamily != normalizedVendorFamily
            || (normalizedPassword is not null && !string.Equals(camera.Password, normalizedPassword, StringComparison.Ordinal));

        var normalizedDisplayName = request.DisplayName.Trim();
        if (!string.Equals(camera.DisplayName, normalizedDisplayName, StringComparison.Ordinal))
        {
            camera.DisplayName = normalizedDisplayName;
            camera.FrigateCameraName = CameraDraftFactory.Slugify(normalizedDisplayName).Replace('-', '_');
        }

        camera.Host = normalizedHost;
        camera.Username = normalizedUsername;
        camera.SourceType = normalizedSourceType;
        camera.VendorFamily = normalizedVendorFamily;

        if (normalizedPassword is not null)
        {
            camera.Password = normalizedPassword;
        }

        if (connectivityChanged)
        {
            CameraConnectionChange.Apply(camera);
        }

        if (request.PtzSupported.HasValue)
        {
            camera.PtzSupported = request.PtzSupported.Value;
        }

        camera.UpdatedAt = DateTimeOffset.UtcNow;

        await cameras.UpdateAsync(camera, ct);
        await SurveillanceConfig.WriteAsync(cameras, frigateConfigApplier, ct);

        return CameraDto.From(camera);
    }
}

public sealed class ApplyCameraUseCase(ICameraRepository cameras, IFrigateConfigApplier frigateConfigApplier)
{
    public async Task<ApplyCameraResultDto?> ExecuteAsync(string id, CancellationToken ct = default)
    {
        var camera = await cameras.GetByIdAsync(id, ct);
        if (camera is null)
        {
            return null;
        }

        if (!string.Equals(camera.Status, "online", StringComparison.OrdinalIgnoreCase))
        {
            var status = CameraStatusDto.From(camera, "Verify the camera stream before applying the Frigate configuration.");
            return new ApplyCameraResultDto(false, "Camera verification is required before apply.", string.Empty, status);
        }

        camera.IsEnabled = true;
        camera.ValidationState = CameraValidationState.Validated;
        camera.UpdatedAt = DateTimeOffset.UtcNow;

        var catalog = await cameras.GetAllAsync(ct);
        var applicable = catalog
            .Where(existing => existing.ValidationState == CameraValidationState.Validated)
            .Where(existing => existing.Id != camera.Id)
            .Append(camera)
            .ToList();

        var applyResult = await frigateConfigApplier.ApplyAsync(applicable, ct);

        if (!applyResult.Applied)
        {
            camera.Status = "config_error";
            camera.ValidationState = CameraValidationState.Draft;
            camera.IsEnabled = false;
            await cameras.UpdateAsync(camera, ct);

            return new ApplyCameraResultDto(
                false,
                applyResult.Message,
                applyResult.ConfigPath,
                CameraStatusDto.From(camera, applyResult.Message));
        }

        await cameras.UpdateAsync(camera, ct);
        return new ApplyCameraResultDto(
            true,
            applyResult.Message,
            applyResult.ConfigPath,
            CameraStatusDto.From(camera, "Camera configuration has been applied to Frigate."));
    }
}

public sealed class DeleteCameraUseCase(ICameraRepository cameras, IFrigateConfigApplier frigateConfigApplier)
{
    public async Task<DeleteCameraResultDto?> ExecuteAsync(string id, CancellationToken ct = default)
    {
        var camera = await cameras.GetByIdAsync(id, ct);
        if (camera is null)
        {
            return null;
        }

        camera.IsEnabled = false;
        camera.ValidationState = CameraValidationState.PendingRemoval;
        camera.UpdatedAt = DateTimeOffset.UtcNow;

        await cameras.UpdateAsync(camera, ct);

        var catalog = await cameras.GetAllAsync(ct);
        var applicable = catalog
            .Where(c => c.IsEnabled && c.ValidationState == CameraValidationState.Validated)
            .ToList();
        await frigateConfigApplier.WriteConfigAsync(applicable, changed: true, ct);

        return new DeleteCameraResultDto(true, $"Camera \"{camera.DisplayName}\" queued for removal. Apply the configuration to update Frigate.", string.Empty);
    }
}

public sealed class ApplyCameraConfigurationUseCase(ICameraRepository cameras, IFrigateConfigApplier frigateConfigApplier)
{
    public async Task<ApplyCameraConfigurationResultDto> ExecuteAsync(CancellationToken ct = default)
    {
        var catalog = await cameras.GetAllAsync(ct);
        var pendingRemovals = catalog
            .Where(camera => camera.ValidationState == CameraValidationState.PendingRemoval)
            .ToList();

        var applicable = catalog
            .Where(camera => camera.ValidationState != CameraValidationState.PendingRemoval)
            .Where(camera => camera.ValidationState == CameraValidationState.Validated
                || string.Equals(camera.Status, "online", StringComparison.OrdinalIgnoreCase))
            .DistinctBy(camera => camera.Id)
            .ToList();

        if (applicable.Count == 0 && pendingRemovals.Count == 0)
        {
            return new ApplyCameraConfigurationResultDto(false, "Aucune camera verifiee a appliquer pour le moment.", string.Empty, 0);
        }

        foreach (var camera in applicable)
        {
            camera.IsEnabled = true;
            camera.ValidationState = CameraValidationState.Validated;
            camera.UpdatedAt = DateTimeOffset.UtcNow;
        }

        var applyResult = await frigateConfigApplier.ApplyAsync(applicable, ct);
        if (!applyResult.Applied)
        {
            foreach (var camera in applicable)
            {
                camera.IsEnabled = false;
                camera.ValidationState = string.Equals(camera.Status, "online", StringComparison.OrdinalIgnoreCase) ? CameraValidationState.Draft : camera.ValidationState;
                await cameras.UpdateAsync(camera, ct);
            }

            return new ApplyCameraConfigurationResultDto(
                false,
                string.IsNullOrWhiteSpace(applyResult.Message) ? "La configuration n'a pas pu etre appliquee." : applyResult.Message,
                applyResult.ConfigPath,
                applicable.Count);
        }

        foreach (var camera in applicable)
        {
            await cameras.UpdateAsync(camera, ct);
        }

        foreach (var removedCamera in pendingRemovals)
        {
            await cameras.DeleteAsync(removedCamera, ct);
        }

        return new ApplyCameraConfigurationResultDto(
            true,
            applicable.Count == 0
                ? "Configuration appliquee. Les suppressions en attente ont ete synchronisees."
                : applicable.Count == 1
                    ? "Configuration appliquee pour 1 camera."
                    : $"Configuration appliquee pour {applicable.Count} cameras.",
            applyResult.ConfigPath,
            applicable.Count);
    }
}

// The stream is a capability like the others: its protocol must answer with its account before the stream is verified (ADR-61).
internal static class StreamVerification
{
    // Detail is what support reads: the protocol's own reason when the protocol failed, the verifier's otherwise.
    public static async Task<(CameraVerificationResult Result, string Detail)> RunAsync(
        Camera camera, CameraProtocolCheck protocolCheck, ICameraVerifier verifier, ProtocolCheckRun? run, CancellationToken ct)
    {
        if (camera.StreamBinding is not { } stream)
        {
            var unbound = await verifier.VerifyAsync(camera, ct);
            return (unbound, unbound.Guidance);
        }

        var protocol = await protocolCheck.CheckAsync(camera, stream.Protocol, run, ct);
        var checkedAt = protocol.CheckedAt ?? DateTimeOffset.UtcNow;
        switch (protocol.Status)
        {
            case ProtocolStatus.Answers:
                var verified = await verifier.VerifyAsync(camera, ct);
                return (verified, verified.Guidance);
            case ProtocolStatus.Refused:
                return (new CameraVerificationResult(true, false, "needs_attention",
                    "La camera refuse le compte pour son flux. Verifiez l'identifiant et le mot de passe, puis relancez la verification.",
                    checkedAt, null), protocol.LastError ?? string.Empty);
            default:
                return (new CameraVerificationResult(false, false, "offline",
                    "Camera injoignable sur le port de son flux. Verifiez l'adresse et le port, puis relancez la verification.",
                    checkedAt, null), protocol.LastError ?? string.Empty);
        }
    }
}

internal static class CameraDraftFactory
{
    // streamProtocols: the transports with a registered stream provider, the ones go2rtc and Frigate take (ADR-19, ADR-32).
    public static Camera Build(CreateCameraRequest request, string slug, IReadOnlyList<SupportedProtocol> streamProtocols)
    {
        if (!SnakeCaseEnum.TryFromSnakeCase<SupportedProtocol>(request.Stream.Protocol, out var streamProtocol)
            || !streamProtocols.Contains(streamProtocol))
            throw new ArgumentException($"Invalid stream protocol '{request.Stream.Protocol}'.");

        var camera = new Camera
        {
            Slug = slug,
            DisplayName = request.DisplayName.Trim(),
            Host = request.Host.Trim(),
            Username = NormalizeOptional(request.Username),
            Password = NormalizeOptional(request.Password),
            VendorFamily = SnakeCaseEnum.TryFromSnakeCase<VendorFamily>(request.VendorFamily, out var vendorFamily) ? vendorFamily : null,
            SourceType = string.IsNullOrWhiteSpace(request.SourceType) ? "rtsp_manual" : request.SourceType.Trim(),
            Status = "needs_attention",
            ValidationState = CameraValidationState.Draft,
            IsEnabled = false,
            FrigateCameraName = slug.Replace('-', '_'),
            UpdatedAt = DateTimeOffset.UtcNow,
        };

        // A camera is born with its stream capability: the protocol that carries it, how to reach
        // that protocol, and the main path when the stream goes over RTSP (ADR-38, ADR-61).
        camera.Capabilities.Add(new CameraCapabilityBinding
        {
            CameraId = camera.Id,
            Capability = CameraCapability.Stream,
            Protocol = streamProtocol,
            ManuallyConfigured = true,
        });
        var protocol = camera.EnsureProtocol(streamProtocol);
        protocol.Port = request.Stream.Port is > 0 && request.Stream.Port != ProtocolPorts.Usual(streamProtocol)
            ? request.Stream.Port
            : null;
        camera.SetMainStreamPath(NormalizeStreamPath(request.Stream.Path));
        return camera;
    }

    public static string? NormalizeOptional(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    public static string? NormalizeStreamPath(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var trimmed = value.Trim();
        return trimmed.StartsWith('/') ? trimmed : $"/{trimmed}";
    }

    public static string Slugify(string value)
    {
        var builder = new StringBuilder();
        var previousDash = false;

        foreach (var character in value.Trim().ToLowerInvariant())
        {
            if (char.IsLetterOrDigit(character))
            {
                builder.Append(character);
                previousDash = false;
                continue;
            }

            if (!previousDash)
            {
                builder.Append('-');
                previousDash = true;
            }
        }

        var slug = builder.ToString().Trim('-');
        return string.IsNullOrWhiteSpace(slug) ? "camera" : slug;
    }
}
