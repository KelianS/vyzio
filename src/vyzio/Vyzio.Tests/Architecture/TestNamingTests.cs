using System.Reflection;
using System.Text.RegularExpressions;

namespace Vyzio.Tests.Architecture;

// Enforces the test name convention of COMMON-10.
public partial class TestNamingTests
{
    [GeneratedRegex("^[A-Za-z][A-Za-z0-9_]*?_Should[A-Z][A-Za-z0-9]*_When[A-Z][A-Za-z0-9]*$")]
    private static partial Regex Convention();

    [Fact]
    public void TestNames_ShouldReadSubjectEffectAndCondition_WhenAnyTestIsDeclared()
    {
        // Arrange
        var tests = typeof(TestNamingTests).Assembly.GetTypes()
            .SelectMany(type => type.GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.Static | BindingFlags.DeclaredOnly))
            .Where(method => method.GetCustomAttributes<FactAttribute>(inherit: true).Any());

        // Act
        var offenders = tests
            .Where(method => !Convention().IsMatch(method.Name))
            .Select(method => $"{method.DeclaringType!.Name}.{method.Name}")
            .ToList();

        // Assert
        Assert.Empty(offenders);
    }
}
