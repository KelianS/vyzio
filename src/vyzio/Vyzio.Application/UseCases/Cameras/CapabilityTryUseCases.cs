using Vyzio.Core.Entities;
using Vyzio.Core.Interfaces;

namespace Vyzio.Application.UseCases.Cameras;

// How long a try acts on the camera: short enough to come back by itself, long enough to be seen (ADR-66 d).
public static class CapabilityTry
{
    public static readonly TimeSpan PtzNudge = TimeSpan.FromMilliseconds(800);

    public static readonly TimeSpan CutHold = TimeSpan.FromSeconds(4);
}

public enum CapabilityTryOutcome
{
    Done,
    NotFound,
    NothingToConfirm,
    PrivacyModeActive,
}

// A real use the user starts on a capability to confirm, never a probe: it records nothing (ADR-66 d).
public sealed class TryCameraCapabilityUseCase(
    ICameraRepository cameras,
    ICameraCapabilityBindingRepository bindings,
    ICapabilityProviderRegistry registry,
    PtzManagedPositions positions,
    TimeProvider time)
{
    public async Task<CapabilityTryOutcome> ExecuteAsync(string cameraId, CameraCapability capability, CancellationToken ct = default)
    {
        if (await cameras.GetByIdAsync(cameraId, ct) is not { } camera) return CapabilityTryOutcome.NotFound;
        if (await bindings.GetAsync(cameraId, capability, ct) is not { } binding || !CapabilityVerdict.Askable(binding))
            return CapabilityTryOutcome.NothingToConfirm;
        // It would uncover or move a camera the user covered.
        if (camera.PrivacyModeActive) return CapabilityTryOutcome.PrivacyModeActive;

        switch (capability)
        {
            case CameraCapability.Ptz:
                await positions.NudgeAsync(camera, binding, registry.ResolvePtz(binding.Protocol), CapabilityTry.PtzNudge, ct);
                return CapabilityTryOutcome.Done;
            case CameraCapability.HardwarePrivacy:
                await CutAsync(camera, binding, registry.ResolvePrivacy(binding.Protocol), ct);
                return CapabilityTryOutcome.Done;
            default:
                return CapabilityTryOutcome.NothingToConfirm;
        }
    }

    private async Task CutAsync(Camera camera, CameraCapabilityBinding binding, IPrivacyCapabilityProvider provider, CancellationToken ct)
    {
        await provider.SetPrivacyModeAsync(camera, binding, true, ct);
        try
        {
            await Task.Delay(CapabilityTry.CutHold, time, ct);
        }
        finally
        {
            // Opened even when the page that asked is gone: a try never leaves the camera cut.
            await provider.SetPrivacyModeAsync(camera, binding, false, CancellationToken.None);
        }
    }
}

public enum CapabilityAnswerOutcome
{
    Recorded,
    NotFound,
    NothingToConfirm,
}

public sealed record CapabilityAnswerResult(CapabilityAnswerOutcome Outcome, CameraCapabilityBindingDto? Binding = null);

// The user's answer after a try: yes makes it usable, confirmed by them; no makes it rejected, and remembered (ADR-66 d).
public sealed class ConfirmCameraCapabilityUseCase(
    ICameraRepository cameras,
    ICameraCapabilityBindingRepository bindings,
    TimeProvider time)
{
    public async Task<CapabilityAnswerResult> ExecuteAsync(string cameraId, CameraCapability capability, bool worked, CancellationToken ct = default)
    {
        if (await cameras.GetByIdAsync(cameraId, ct) is not { } camera) return new(CapabilityAnswerOutcome.NotFound);
        if (await bindings.GetAsync(cameraId, capability, ct) is not { } binding || !CapabilityVerdict.Askable(binding))
            return new(CapabilityAnswerOutcome.NothingToConfirm);

        CapabilityVerdict.Answer(binding, worked, time.GetUtcNow());
        await bindings.SaveAsync(binding, ct);

        CapabilityVerdict.ShowPtzPanel(camera, binding);
        await cameras.UpdateAsync(camera, ct);

        return new(CapabilityAnswerOutcome.Recorded, CameraCapabilityBindingDto.From(binding));
    }
}
