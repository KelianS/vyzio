using Vyzio.Core.Entities;

namespace Vyzio.Core.Interfaces;

public interface IHardwareAccelerationDetector
{
    FrigateDetectorKind Detect();
}
