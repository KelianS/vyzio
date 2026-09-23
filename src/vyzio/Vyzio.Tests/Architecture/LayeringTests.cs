using System.Reflection;
using Vyzio.Application.UseCases.Profiles;
using Vyzio.Core.Entities;
using Vyzio.Infrastructure.Persistence;

namespace Vyzio.Tests.Architecture;

// Enforces the dependency direction stated in src/vyzio/CLAUDE.md.
public class LayeringTests
{
    private static readonly Assembly Core = typeof(Camera).Assembly;
    private static readonly Assembly Application = typeof(CreateProfileUseCase).Assembly;
    private static readonly Assembly Infrastructure = typeof(VyzioDbContext).Assembly;
    private static readonly string? RuntimeDirectory = Path.GetDirectoryName(typeof(object).Assembly.Location);

    [Fact]
    public void Core_ShouldReferenceOnlyTheRuntime_WhenBuilt()
    {
        // Arrange
        var references = ReferencedNames(Core);

        // Act
        var outsideRuntime = references.Where(name => !IsRuntime(name)).ToList();

        // Assert
        Assert.Empty(outsideRuntime);
    }

    [Fact]
    public void Application_ShouldReferenceOnlyCoreAndAbstractions_WhenBuilt()
    {
        // Arrange
        var references = ReferencedNames(Application);

        // Act
        var forbidden = references
            .Where(name => !IsRuntime(name))
            .Where(name => name != Core.GetName().Name)
            .Where(name => !(name.StartsWith("Microsoft.Extensions.", StringComparison.Ordinal)
                             && name.EndsWith(".Abstractions", StringComparison.Ordinal)))
            .ToList();

        // Assert
        Assert.Empty(forbidden);
    }

    [Fact]
    public void Infrastructure_ShouldNotReferenceApplicationOrApi_WhenBuilt()
    {
        // Arrange
        var references = ReferencedNames(Infrastructure);

        // Act
        var upward = references
            .Where(name => name is "Vyzio.Application" or "Vyzio.Api")
            .ToList();

        // Assert
        Assert.Empty(upward);
    }

    private static List<string> ReferencedNames(Assembly assembly) =>
        assembly.GetReferencedAssemblies().Select(reference => reference.Name!).ToList();

    // Loaded from the shared framework's folder, so a NuGet package merely named System.* does not pass.
    private static bool IsRuntime(string name) =>
        Path.GetDirectoryName(Assembly.Load(name).Location) == RuntimeDirectory;
}
