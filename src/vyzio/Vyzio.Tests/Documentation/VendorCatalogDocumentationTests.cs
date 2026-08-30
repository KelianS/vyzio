using System.Text.RegularExpressions;
using Vyzio.Core.Common;
using Vyzio.Core.Entities;

namespace Vyzio.Tests.Documentation;

// vendors/README.md is the single source for supported hardware, and it drifted from the code
// once already: it still named CapabilityProtocol and CameraCapability.PrivacyMode months after
// both were gone, so anyone following it wrote code that does not compile. These tests pin the
// parts a reader would act on to the code that decides them.
public sealed class VendorCatalogDocumentationTests
{
    private static readonly string VendorsDirectory = LocateVendorsDirectory();
    private static readonly string Readme =
        File.ReadAllText(Path.Combine(VendorsDirectory, "README.md")).Replace("\r\n", "\n");

    [Fact]
    public void VendorCatalogReadme_ShouldRenderTheCapabilityBlock_WhenPresetsAreDeclaredInCode()
    {
        var expected = string.Join('\n', VendorCapabilityPresets.All.Select(preset =>
            $"{preset.VendorFamily} → " + string.Join(", ", preset.DefaultBindings.Select(binding =>
                $"{binding.Capability}/[{string.Join(", ", binding.Protocols)}]"))));

        var block = Regex.Match(
            Readme,
            @"<!-- vendor-presets:start -->\n```\n(?<block>.*?)\n```\n<!-- vendor-presets:end -->",
            RegexOptions.Singleline);

        Assert.True(block.Success, "The vendor-presets markers are missing from vendors/README.md.");
        Assert.Equal(expected, block.Groups["block"].Value);
    }

    [Theory]
    [MemberData(nameof(EveryVendorFamily))]
    public void VendorCatalogReadme_ShouldCarryASheetAndATableRow_WhenAVendorFamilyIsDeclared(VendorFamily family)
    {
        var id = SnakeCaseEnum.ToSnakeCase(family);

        Assert.True(
            File.Exists(Path.Combine(VendorsDirectory, $"{id}.md")),
            $"vendors/{id}.md is missing: the interface serves this sheet on discovery.");
        Assert.Contains($"| `{family}` | `{id}` |", Readme);
    }

    [Fact]
    public void VendorCatalogReadme_ShouldListNoUnknownFamily_WhenTheSupportedHardwareTableIsRead()
    {
        var listed = Regex.Matches(Readme, @"^\| `(?<family>\w+)` \| `(?<id>\w+)` \|", RegexOptions.Multiline);

        foreach (Match row in listed)
        {
            var family = row.Groups["family"].Value;
            Assert.True(
                Enum.TryParse<VendorFamily>(family, out _),
                $"vendors/README.md lists '{family}', which is not a VendorFamily value.");
        }
    }

    public static TheoryData<VendorFamily> EveryVendorFamily() => [.. Enum.GetValues<VendorFamily>()];

    // The sheets are repository content served at runtime, not build output: walk up to the
    // solution rather than looking beside the test assembly.
    private static string LocateVendorsDirectory()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "Vyzio.slnx")))
        {
            directory = directory.Parent;
        }

        Assert.NotNull(directory);
        return Path.Combine(directory!.FullName, "vendors");
    }
}
