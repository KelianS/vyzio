using System.Net;
using System.Text;

namespace Vyzio.Tests.Services;

// An ONVIF camera answering each PTZ question with a canned body; a null body is refused with a 404.
internal sealed class FakeOnvifPtzCamera(string profiles, string? configurationOptions, string presets = FakeOnvifPtzCamera.NoPresetsXml)
    : HttpMessageHandler
{
    public const string ProfileWithoutPtzXml = """
        <s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope">
          <s:Body>
            <trt:GetProfilesResponse xmlns:trt="http://www.onvif.org/ver10/media/wsdl">
              <trt:Profiles token="profile_1"/>
            </trt:GetProfilesResponse>
          </s:Body>
        </s:Envelope>
        """;

    public const string ProfileWithPtzXml = """
        <s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope">
          <s:Body>
            <trt:GetProfilesResponse xmlns:trt="http://www.onvif.org/ver10/media/wsdl">
              <trt:Profiles token="profile_1">
                <tt:PTZConfiguration xmlns:tt="http://www.onvif.org/ver10/schema" token="ptz_cfg_1"/>
              </trt:Profiles>
            </trt:GetProfilesResponse>
          </s:Body>
        </s:Envelope>
        """;

    public const string PtzOptionsXml = """
        <s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope">
          <s:Body>
            <tptz:GetConfigurationOptionsResponse xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl">
              <tptz:PTZConfigurationOptions/>
            </tptz:GetConfigurationOptionsResponse>
          </s:Body>
        </s:Envelope>
        """;

    public const string PtzOptionsWithRelativeMoveXml = """
        <s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope">
          <s:Body>
            <tptz:GetConfigurationOptionsResponse xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl" xmlns:tt="http://www.onvif.org/ver10/schema">
              <tptz:PTZConfigurationOptions>
                <tt:Spaces>
                  <tt:RelativePanTiltTranslationSpace/>
                </tt:Spaces>
              </tptz:PTZConfigurationOptions>
            </tptz:GetConfigurationOptionsResponse>
          </s:Body>
        </s:Envelope>
        """;

    public const string OnePresetXml = """
        <s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope">
          <s:Body>
            <tptz:GetPresetsResponse xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl">
              <tptz:Preset token="1"/>
            </tptz:GetPresetsResponse>
          </s:Body>
        </s:Envelope>
        """;

    public const string NoPresetsXml = """
        <s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope">
          <s:Body>
            <tptz:GetPresetsResponse xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl"/>
          </s:Body>
        </s:Envelope>
        """;

    // Carries an ONVIF marker, so a port sweep recognises the camera (ADR-56).
    private const string EmptyAnswerXml = """
        <s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:tds="http://www.onvif.org/ver10/device/wsdl"><s:Body/></s:Envelope>
        """;

    public List<string> Bodies { get; } = [];

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        var body = request.Content is null ? string.Empty : await request.Content.ReadAsStringAsync(ct);
        lock (Bodies) Bodies.Add(body);

        var answer = AnswerTo(body);
        return answer is null
            ? new HttpResponseMessage(HttpStatusCode.NotFound)
            : new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(answer, Encoding.UTF8, "application/soap+xml") };
    }

    private string? AnswerTo(string body)
    {
        if (body.Contains("<GetProfiles", StringComparison.Ordinal)) return profiles;
        if (body.Contains("<GetConfigurationOptions", StringComparison.Ordinal)) return configurationOptions;
        if (body.Contains("<GetPresets", StringComparison.Ordinal)) return presets;
        return EmptyAnswerXml;
    }
}
