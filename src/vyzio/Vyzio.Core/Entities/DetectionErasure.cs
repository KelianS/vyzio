namespace Vyzio.Core.Entities;

/// <summary>
/// What became of a request to erase one detection from the surveillance (SPECS 6.2).
/// </summary>
public enum DetectionErasure
{
    /// <summary>The detection, its images, its review item and the recording overlapping it are gone.</summary>
    Erased,

    /// <summary>The surveillance knows no detection under that id: nothing was touched.</summary>
    NotFound,

    /// <summary>Still being filmed: the surveillance would write it back, so nothing was touched.</summary>
    InProgress
}
