using Vyzio.Application.DTOs.DetectionEvents;
using Vyzio.Core.Entities;

namespace Vyzio.Application.UseCases.DetectionEvents;

public sealed class DetectionEventContractProjector
{
    public DetectionEventContract ToContract(DetectionEvent detectionEvent)
    {
        ArgumentNullException.ThrowIfNull(detectionEvent);

        return new DetectionEventContract(
            detectionEvent.Id,
            detectionEvent.FrigateEventId,
            detectionEvent.Lifecycle,
            detectionEvent.Camera,
            detectionEvent.Label,
            detectionEvent.Identity,
            detectionEvent.ProfileId,
            detectionEvent.Confidence,
            detectionEvent.OccurredAt,
            detectionEvent.HasClip,
            detectionEvent.HasSnapshot);
    }

    public IReadOnlyList<DetectionEventContract> ToContracts(IEnumerable<DetectionEvent> detectionEvents)
    {
        ArgumentNullException.ThrowIfNull(detectionEvents);

        return detectionEvents.Select(ToContract).ToArray();
    }
}