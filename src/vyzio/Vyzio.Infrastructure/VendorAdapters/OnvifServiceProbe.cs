namespace Vyzio.Infrastructure.VendorAdapters;

// What an ONVIF service answers, and how to ask without credentials. One home for both users:
// the discovery fingerprint (raw socket, sweeping a whole subnet) and OnvifEndpointResolver
// (HttpClient, one known camera). The transports differ by context; the question and the way its
// answer is recognised must not (ADR-56).
internal static class OnvifServiceProbe
{
    // GetSystemDateAndTime is defined by the ONVIF core spec as requiring no authentication, so it
    // identifies a service without ever presenting a credential to a port that may not be a camera.
    // Repeated credentialed guesses lock accounts out on some firmwares (a Tapo cools down ~25 min).
    public const string CredentialFreeEnvelope =
        """<?xml version="1.0" encoding="utf-8"?><s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"><s:Body><GetSystemDateAndTime xmlns="http://www.onvif.org/ver10/device/wsdl"/></s:Body></s:Envelope>""";

    // Accepts the answer of a device that demands authentication as readily as a full response: the
    // question is whether ONVIF lives here, not whether this envelope was allowed through.
    public static bool LooksLikeOnvif(string response)
    {
        var normalized = response.ToLowerInvariant();

        var hasSoapEnvelope = normalized.Contains("application/soap+xml")
            || normalized.Contains("<s:envelope")
            || normalized.Contains("<soap:envelope")
            || normalized.Contains("<soap-env:envelope");

        var hasOnvifMarker = normalized.Contains("onvif.org/")
            || normalized.Contains("/onvif/device_service")
            || normalized.Contains("getsystemdateandtimeresponse")
            || normalized.Contains("getcapabilitiesresponse")
            || normalized.Contains("getservicesresponse")
            || normalized.Contains("device_service")
            || normalized.Contains("trt:")
            || normalized.Contains("tds:")
            || normalized.Contains("realm=\"onvif\"")
            || normalized.Contains("realm='onvif'");

        return hasSoapEnvelope && hasOnvifMarker;
    }
}
