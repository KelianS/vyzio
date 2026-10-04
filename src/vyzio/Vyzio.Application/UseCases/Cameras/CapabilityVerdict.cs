using Vyzio.Core.Entities;

namespace Vyzio.Application.UseCases.Cameras;

// Turns a check's outcome or the user's answer into the binding's one state (ADR-66 c).
internal static class CapabilityVerdict
{
    public static void Apply(CameraCapabilityBinding binding, CapabilityProof proof)
    {
        switch (proof.Outcome)
        {
            case ProofOutcome.Proven:
                // A proof outranks the user's word: the card then says the camera showed it.
                binding.Status = CapabilityStatus.Verified;
                binding.ConfirmedAt = null;
                binding.LastError = null;
                break;
            case ProofOutcome.Missing:
                binding.Status = CapabilityStatus.Missing;
                binding.LastError = proof.Detail;
                break;
            case ProofOutcome.Unprovable:
                binding.Status = binding.ConfirmedAt is null ? CapabilityStatus.ToConfirm : CapabilityStatus.Verified;
                binding.LastError = null;
                break;
            default:
                throw new ArgumentOutOfRangeException(nameof(proof), proof.Outcome, "Unknown proof outcome.");
        }
    }

    // The confirmation survives a failure: a camera asleep for a while keeps what the user saw (ADR-66 c).
    public static void Fail(CameraCapabilityBinding binding, string? reason)
    {
        binding.Status = CapabilityStatus.Failed;
        binding.LastError = reason;
    }

    // The stream has no proof of its own: its verification is its check (ADR-61).
    public static void Stream(CameraCapabilityBinding binding, bool previewAvailable, string? reason)
    {
        binding.Status = previewAvailable ? CapabilityStatus.Verified : CapabilityStatus.Failed;
        binding.LastError = previewAvailable ? null : reason;
    }

    // Before a check on another protocol: what the former one showed, or the user confirmed, no longer holds.
    public static void Reset(CameraCapabilityBinding binding, SupportedProtocol protocol)
    {
        if (binding.Protocol != protocol) binding.ConfirmedAt = null;
        binding.Protocol = protocol;
        binding.Status = CapabilityStatus.Failed;
        binding.LastError = null;
    }

    public static void Answer(CameraCapabilityBinding binding, bool worked, DateTimeOffset now)
    {
        binding.Status = worked ? CapabilityStatus.Verified : CapabilityStatus.RejectedByUser;
        binding.ConfirmedAt = worked ? now : null;
        binding.VerifiedAt = now;
        binding.LastError = null;
    }

    // A PTZ the camera showed, or the user confirmed, opens the joystick without a manual step.
    public static void ShowPtzPanel(Camera camera, CameraCapabilityBinding binding)
    {
        if (binding.Capability == CameraCapability.Ptz && binding.Verified && !camera.PtzSupported)
            camera.PtzSupported = true;
    }
}
