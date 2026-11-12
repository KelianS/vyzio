namespace Vyzio.Core.Interfaces;

/// <summary>
/// The detections the user erased while a notification for them may still be on its way (HIST-10).
/// </summary>
public interface IErasedDetections
{
    void Remember(string frigateEventId);

    bool Contains(string frigateEventId);
}
