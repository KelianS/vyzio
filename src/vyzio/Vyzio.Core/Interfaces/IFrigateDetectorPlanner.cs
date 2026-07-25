using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

public interface IFrigateDetectorPlanner
{
    FrigateDetectorPlan Plan(int activeCameraCount);
}
