namespace Vyzio.Core.Interfaces;

public interface IFrigateRestartTracker
{
    bool IsRestarting { get; }
    void MarkRestarting();
    void MarkRestartComplete();
}
