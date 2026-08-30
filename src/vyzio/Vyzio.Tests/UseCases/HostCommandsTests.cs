using Vyzio.Api;

namespace Vyzio.Tests.UseCases;

/// <summary>
/// The parsing matters more than it looks: a mistake here either starts the API as a command, or
/// starts a command as the API (ADR-54).
/// </summary>
public class HostCommandsTests
{
    [Fact]
    public void Serving_is_what_happens_when_no_command_was_asked_for()
    {
        Assert.Null(HostCommands.Match([]));
        Assert.Null(HostCommands.Match(["--urls", "http://+:8443"]));
    }

    [Fact]
    public void Only_the_exact_command_is_a_command()
    {
        Assert.Equal(HostCommands.ResetPassword, HostCommands.Match([HostCommands.ResetPassword]));
        Assert.Null(HostCommands.Match(["reset-passwords"]));
        Assert.Null(HostCommands.Match([HostCommands.ResetPassword, "--force"]));
    }
}
