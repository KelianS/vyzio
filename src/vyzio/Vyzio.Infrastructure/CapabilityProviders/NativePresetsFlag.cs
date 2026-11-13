using System.Text.Json;
using Vyzio.Core.Common;
using Vyzio.Core.Entities;

namespace Vyzio.Infrastructure.CapabilityProviders;

// Where a PTZ probe records whether the camera keeps presets of its own, which routes its positions (ADR-09).
internal static class NativePresetsFlag
{
    public static void Record(CameraCapabilityBinding binding, bool supported)
    {
        try
        {
            binding.ConfigJson = BindingConfig.With(binding.ConfigJson, BindingConfig.SupportsNativePresets, supported);
        }
        catch (JsonException)
        {
            // An unreadable config holds nothing worth keeping; the probe writes a fresh one (ADR-09).
            binding.ConfigJson = BindingConfig.With(null, BindingConfig.SupportsNativePresets, supported);
        }
    }
}
