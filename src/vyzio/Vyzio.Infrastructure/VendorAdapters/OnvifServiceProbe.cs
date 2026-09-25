namespace Vyzio.Infrastructure.VendorAdapters;

// One question and one way to read its answer, for discovery and the resolver alike (ADR-56).
internal static class OnvifServiceProbe
{
    // Needs no authentication by the ONVIF core spec: credentialed guesses lock a Tapo out (ADR-56).
    public const string CredentialFreeEnvelope =
        """<?xml version="1.0" encoding="utf-8"?><s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"><s:Body><GetSystemDateAndTime xmlns="http://www.onvif.org/ver10/device/wsdl"/></s:Body></s:Envelope>""";

    // The question is whether ONVIF lives here, not whether this envelope was let through.
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

    // The one reading of an answer: a 404 is no service, a 401 with an ONVIF realm still is one.
    public static bool Identifies(int status, string wwwAuthenticate, string body)
    {
        if (status == 404) return false;
        if (status == 401)
            return body.Contains("onvif", StringComparison.OrdinalIgnoreCase)
                || wwwAuthenticate.Contains("onvif", StringComparison.OrdinalIgnoreCase);
        return LooksLikeOnvif(body);
    }

    // The same reading, for a raw HTTP answer read off a socket.
    public static bool IdentifiesRawHttp(string response)
    {
        var lines = response.Split("\r\n");
        var statusParts = lines[0].Split(' ', 3);
        if (statusParts.Length < 2 || !int.TryParse(statusParts[1], out var status)) return false;
        var wwwAuthenticate = lines
            .TakeWhile(line => line.Length > 0)
            .FirstOrDefault(line => line.StartsWith("WWW-Authenticate:", StringComparison.OrdinalIgnoreCase)) ?? string.Empty;
        return Identifies(status, wwwAuthenticate, response);
    }
}
