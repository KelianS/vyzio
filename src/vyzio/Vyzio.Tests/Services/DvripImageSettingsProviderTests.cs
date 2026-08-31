using System.Text.Json.Nodes;
using Microsoft.Extensions.Logging.Abstractions;
using Vyzio.Core.Entities;
using Vyzio.Infrastructure.CapabilityProviders;
using Vyzio.Infrastructure.VendorAdapters;

namespace Vyzio.Tests.Services;

// The real ICSee/XMEye "AVEnc.VideoColor.[0]" JSON schema (flat vs. nested under a "Level"
// schedule array) isn't confirmed from the terrain investigation (docs/investigations/
// icsee_dvrip_privacy.md only confirms the dot-notation paths, not the raw JSON shape) —
// these tests lock down that the resilient tree-search/mutate logic handles both shapes
// without needing to guess which one a given firmware actually returns.
public class DvripImageSettingsProviderTests
{
    [Fact]
    public void FindIntProperty_finds_flat_property()
    {
        var node = JsonNode.Parse("""{"Brightness": 62, "Contrast": 40}""");

        Assert.Equal(62, DvripImageSettingsProvider.FindIntProperty(node, "Brightness"));
    }

    [Fact]
    public void FindIntProperty_finds_property_nested_under_level_array()
    {
        var node = JsonNode.Parse("""
            {"Level": [{"BeginTime": "0 00:00:00", "Brightness": 55, "Contrast": 48}]}
            """);

        Assert.Equal(55, DvripImageSettingsProvider.FindIntProperty(node, "Brightness"));
    }

    [Fact]
    public void FindIntProperty_returns_null_when_absent()
    {
        var node = JsonNode.Parse("""{"Contrast": 40}""");

        Assert.Null(DvripImageSettingsProvider.FindIntProperty(node, "Brightness"));
    }

    [Fact]
    public void SetIntProperty_mutates_flat_property_in_place()
    {
        var node = JsonNode.Parse("""{"Brightness": 62, "Contrast": 40}""")!;

        var found = DvripImageSettingsProvider.SetIntProperty(node, "Brightness", 10);

        Assert.True(found);
        Assert.Equal(10, node["Brightness"]!.GetValue<int>());
        Assert.Equal(40, node["Contrast"]!.GetValue<int>()); // untouched sibling preserved
    }

    [Fact]
    public void SetIntProperty_mutates_every_entry_in_a_level_schedule_array()
    {
        var node = JsonNode.Parse("""
            {"Level": [{"Brightness": 55}, {"Brightness": 60}]}
            """)!;

        var found = DvripImageSettingsProvider.SetIntProperty(node, "Brightness", 1);

        Assert.True(found);
        Assert.Equal(1, node["Level"]![0]!["Brightness"]!.GetValue<int>());
        Assert.Equal(1, node["Level"]![1]!["Brightness"]!.GetValue<int>());
    }

    [Fact]
    public void SetIntProperty_returns_false_when_property_not_found_anywhere()
    {
        var node = JsonNode.Parse("""{"Contrast": 40}""")!;

        var found = DvripImageSettingsProvider.SetIntProperty(node, "Brightness", 1);

        Assert.False(found);
    }

    [Fact]
    public void Protocol_is_Dvrip()
    {
        var provider = new DvripImageSettingsProvider(new DvripClient(NullLogger<DvripClient>.Instance));
        Assert.Equal(SupportedProtocol.Dvrip, provider.Protocol);
    }

    // ADR-28/29: unlike DvripPtzProvider (which swallows and returns false), image settings
    // calls let DvripCallException propagate so the real reason ends up in LastError.
    [Fact]
    public async Task GetImageSettingsAsync_throws_descriptive_exception_when_camera_unreachable()
    {
        var provider = new DvripImageSettingsProvider(new DvripClient(NullLogger<DvripClient>.Instance));
        var camera = new Camera { Slug = "cam", FrigateCameraName = "cam", DisplayName = "cam", Host = "127.0.0.1" };
        var binding = new CameraCapabilityBinding { CameraId = "cam", Capability = CameraCapability.ImageSettings, Protocol = SupportedProtocol.Dvrip };

        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(4));
        var ex = await Assert.ThrowsAsync<DvripCallException>(
            () => provider.GetImageSettingsAsync(camera, binding, cts.Token));

        Assert.Contains("127.0.0.1", ex.Message);
    }
}
