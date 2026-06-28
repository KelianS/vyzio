using Vyzio.Infrastructure.VendorAdapters;

namespace Vyzio.Tests.Services;

public class ICSeeAdapterTests
{
    // Sofia hash: sum of each pair of MD5 hex chars (lowercase) mod 62, mapped to [0-9A-Za-z].
    // Validated live against a real ICSee camera (192.168.1.193, June 2026).
    [Fact]
    public void SofiaHash_produces_known_verified_value()
    {
        // This value was confirmed by successful login to a real ICSee camera.
        Assert.Equal("6DDKEOQCGQGGILIK", ICSeeXMEyeCameraAdapter.SofiaHash("a4m3h5"));
    }

    [Fact]
    public void SofiaHash_empty_password_returns_16_chars()
    {
        // MD5("") = d41d8cd98f00b204e9800998ecf8427e — just verify structural properties.
        var result = ICSeeXMEyeCameraAdapter.SofiaHash(string.Empty);
        Assert.Equal(16, result.Length);
    }

    [Fact]
    public void SofiaHash_returns_16_char_string()
    {
        var result = ICSeeXMEyeCameraAdapter.SofiaHash("any_password_here");
        Assert.Equal(16, result.Length);
    }

    [Fact]
    public void SofiaHash_uses_only_allowed_charset()
    {
        const string allowed = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
        var result = ICSeeXMEyeCameraAdapter.SofiaHash("test_password_123!");
        Assert.All(result, c => Assert.Contains(c, allowed));
    }

    [Fact]
    public void VendorFamily_is_icsee()
    {
        var adapter = new ICSeeXMEyeCameraAdapter(Microsoft.Extensions.Logging.Abstractions.NullLogger<ICSeeXMEyeCameraAdapter>.Instance);
        Assert.Equal("icsee", adapter.VendorFamily);
    }

    [Fact]
    public async Task SupportsPtz_returns_true()
    {
        var adapter = new ICSeeXMEyeCameraAdapter(Microsoft.Extensions.Logging.Abstractions.NullLogger<ICSeeXMEyeCameraAdapter>.Instance);
        var camera = new Vyzio.Core.Entities.Camera { Slug = "c", DisplayName = "c", Host = "192.168.1.1" };
        Assert.True(await adapter.SupportsPtzAsync(camera));
    }

    [Fact]
    public async Task SupportsPrivacyMode_returns_false()
    {
        var adapter = new ICSeeXMEyeCameraAdapter(Microsoft.Extensions.Logging.Abstractions.NullLogger<ICSeeXMEyeCameraAdapter>.Instance);
        var camera = new Vyzio.Core.Entities.Camera { Slug = "c", DisplayName = "c", Host = "192.168.1.1" };
        Assert.False(await adapter.SupportsPrivacyModeAsync(camera));
    }
}
