using System.Text.Json;
using Vyzio.Core.Common;

namespace Vyzio.Tests.Common;

public class BindingConfigTests
{
    [Fact]
    public void Carry_ShouldKeepTheSwap_WhenANewConfigDoesNotNameIt()
    {
        var carried = BindingConfig.Carry("""{"pan_inverted":true}""", """{"device_id":42}""", BindingConfig.PanInverted);

        Assert.True(BindingConfig.ReadBool(carried, BindingConfig.PanInverted));
        Assert.Contains("\"device_id\":42", carried, StringComparison.Ordinal);
    }

    [Fact]
    public void Carry_ShouldLeaveTheNewConfig_WhenTheOldOneHadNoSwap()
    {
        Assert.Null(BindingConfig.Carry("""{"supports_native_presets":true}""", null, BindingConfig.PanInverted));
    }

    [Fact]
    public void With_ShouldRaise_WhenTheConfigCannotBeRead()
    {
        Assert.ThrowsAny<JsonException>(() => BindingConfig.With("not json", BindingConfig.PanInverted, true));
    }

    [Fact]
    public void Carry_ShouldKeepAnExplicitChoice_WhenTheNewConfigNamesTheSwap()
    {
        var carried = BindingConfig.Carry("""{"pan_inverted":true}""", """{"pan_inverted":false}""", BindingConfig.PanInverted);

        Assert.False(BindingConfig.ReadBool(carried, BindingConfig.PanInverted));
    }

    [Fact]
    public void Carry_ShouldLeaveAnUnreadableConfigToTheProbe_WhenTheOldOneHadTheSwap()
    {
        Assert.Equal("not json", BindingConfig.Carry("""{"pan_inverted":true}""", "not json", BindingConfig.PanInverted));
    }
}
