namespace Vyzio.Tests.Contracts;

// The ONVIF scenarios tools/camera-capture records, by the name of their transcript.
internal static class OnvifScenario
{
    public const string Discovery = "discovery-get-system-date-and-time";
    public const string GetServices = "get-services";
    public const string GetDeviceInformation = "get-device-information";
    public const string GetDeviceInformationRefused = "get-device-information-refused";
    public const string GetProfiles = "get-profiles";
    public const string GetStreamUri = "get-stream-uri";
    public const string PtzGetConfigurationOptions = "ptz-get-configuration-options";
    public const string PtzGetStatus = "ptz-get-status";
    public const string PtzGetPresets = "ptz-get-presets";
    public const string PtzSetPresetAndRemove = "ptz-set-preset-and-remove";
    public const string ImagingGetImagingSettings = "imaging-get-imaging-settings";
}
