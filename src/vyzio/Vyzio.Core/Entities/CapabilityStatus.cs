namespace Vyzio.Core.Entities;

// Where a capability stands after its last check or the user's answer; only Verified makes it usable (ADR-66).
public enum CapabilityStatus
{
    // The check could not talk to the camera, or never ran; LastError says why.
    Failed,

    // Proven by a read, or confirmed by the user after a try.
    Verified,

    // No read can prove it: waits for the user to try it and answer.
    ToConfirm,

    // The camera answered the read, and it shows the capability is not there.
    Missing,

    // The user tried it and answered that it did not work.
    RejectedByUser,
}
