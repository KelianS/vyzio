using Microsoft.Extensions.Logging.Abstractions;
using Vyzio.Core.Common;
using Vyzio.Core.Entities;
using Vyzio.Infrastructure.VendorAdapters;

namespace Vyzio.Tests.Services;

public class V380DeviceIdBootstrapTests
{
    [Fact]
    public void PersistIfDiscovered_ShouldAddTheDeviceIdAndKeepTheRest_WhenTheBindingHasAConfig()
    {
        var client = new V380Client(NullLogger<V380Client>.Instance);
        client.PreloadDeviceId("192.168.1.20", 26970853);
        var binding = new CameraCapabilityBinding
        {
            CameraId = "cam1",
            Capability = CameraCapability.Ptz,
            Protocol = SupportedProtocol.V380,
            ConfigJson = """{"pan_inverted":true}""",
        };

        V380DeviceIdBootstrap.PersistIfDiscovered(binding, client, "192.168.1.20");

        Assert.True(BindingConfig.ReadBool(binding.ConfigJson, BindingConfig.PanInverted));
        Assert.True(V380DeviceIdBootstrap.TryReadDeviceId(binding.ConfigJson, out var deviceId));
        Assert.Equal(26970853u, deviceId);
    }
}
