using Vyzio.Api;

namespace Vyzio.Tests.UseCases;

/// <summary>
/// The parsing matters more than it looks: a mistake here either starts the API as a command, or
/// starts a command as the API (ADR-54).
/// </summary>
public class HostCommandsTests
{
    [Fact]
    public void Match_ShouldReturnNullSoTheApiServes_WhenNoCommandWasAskedFor()
    {
        Assert.Null(HostCommands.Match([]));
        Assert.Null(HostCommands.Match(["--urls", "http://+:8443"]));
    }

    [Fact]
    public void Match_ShouldRecognizeTheCommand_WhenTheArgumentsAreExactlyTheCommand()
    {
        Assert.Equal(HostCommands.ResetPassword, HostCommands.Match([HostCommands.ResetPassword]));
        Assert.Null(HostCommands.Match(["reset-passwords"]));
        Assert.Null(HostCommands.Match([HostCommands.ResetPassword, "--force"]));
    }
}
