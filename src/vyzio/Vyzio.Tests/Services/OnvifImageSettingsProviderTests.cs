using System.Net;
using System.Text;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Vyzio.Core.Entities;
using Vyzio.Infrastructure.CapabilityProviders;
using Vyzio.Infrastructure.VendorAdapters;

namespace Vyzio.Tests.Services;

public class OnvifImageSettingsProviderTests
{
    // Realistic GetProfiles response: SourceToken is a CHILD ELEMENT of VideoSourceConfiguration,
    // not an attribute — regression guard for the bug where GetVideoSourceTokenAsync always
    // returned null because it looked for an attribute instead of the child element.
    private const string ProfilesXml = """
        <s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope">
          <s:Body>
            <trt:GetProfilesResponse xmlns:trt="http://www.onvif.org/ver10/media/wsdl" xmlns:tt="http://www.onvif.org/ver10/schema">
              <trt:Profiles token="profile_1">
                <tt:VideoSourceConfiguration token="vsc_1">
                  <tt:Name>VideoSourceConfig</tt:Name>
                  <tt:UseCount>1</tt:UseCount>
                  <tt:SourceToken>video_source_1</tt:SourceToken>
                </tt:VideoSourceConfiguration>
              </trt:Profiles>
            </trt:GetProfilesResponse>
          </s:Body>
        </s:Envelope>
        """;

    private const string ImagingSettingsXml = """
        <s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope">
          <s:Body>
            <timg:GetImagingSettingsResponse xmlns:timg="http://www.onvif.org/ver20/imaging/wsdl" xmlns:tt="http://www.onvif.org/ver10/schema">
              <timg:ImagingSettings>
                <tt:Brightness>55</tt:Brightness>
                <tt:Contrast>60</tt:Contrast>
                <tt:ColorSaturation>65</tt:ColorSaturation>
                <tt:Sharpness>70</tt:Sharpness>
                <tt:IrCutFilter>AUTO</tt:IrCutFilter>
              </timg:ImagingSettings>
            </timg:GetImagingSettingsResponse>
          </s:Body>
        </s:Envelope>
        """;

    private static Camera MakeCamera() => new()
    {
        Id = "cam1",
        Slug = "cam1",
        DisplayName = "ONVIF Cam",
        Host = "192.168.1.100",
        Port = 8899,
        Username = "admin",
        Password = "pass",
    };

    private static CameraCapabilityBinding MakeBinding() => new()
    {
        CameraId = "cam1",
        Capability = CameraCapability.ImageSettings,
        Protocol = SupportedProtocol.Onvif,
        Verified = false,
    };

    private static (OnvifImageSettingsProvider provider, List<HttpRequestMessage> requests) MakeProvider()
    {
        var captured = new List<HttpRequestMessage>();
        HttpMessageHandler handler = new RoutingStubHandler(captured, request =>
        {
            var body = request.Content?.ReadAsStringAsync().GetAwaiter().GetResult() ?? string.Empty;
            var responseBody = body.Contains("GetImagingSettings") ? ImagingSettingsXml : ProfilesXml;
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(responseBody, Encoding.UTF8, "application/soap+xml"),
            };
        });
        var factory = Substitute.For<IHttpClientFactory>();
        factory.CreateClient("onvif").Returns(new HttpClient(handler));
        var onvifClient = new OnvifClient(factory, NullLogger<OnvifClient>.Instance);
        return (new OnvifImageSettingsProvider(onvifClient), captured);
    }

    [Fact]
    public async Task ProbeAsync_returns_true_when_video_source_token_and_settings_resolve()
    {
        var (provider, _) = MakeProvider();

        var result = await provider.ProbeAsync(MakeCamera(), MakeBinding());

        Assert.True(result);
    }

    [Fact]
    public async Task GetImageSettingsAsync_parses_video_source_token_from_child_element_not_attribute()
    {
        var (provider, requests) = MakeProvider();

        var settings = await provider.GetImageSettingsAsync(MakeCamera(), MakeBinding());

        Assert.NotNull(settings);
        Assert.Equal(55, settings!.Brightness);
        Assert.Equal(60, settings.Contrast);
        Assert.Equal(65, settings.Saturation);
        Assert.Equal(70, settings.Sharpness);
        Assert.Equal(IrCutMode.Auto, settings.IrCutMode);

        var imagingRequestBody = await requests
            .Last(r => (r.Content?.ReadAsStringAsync().GetAwaiter().GetResult() ?? "").Contains("GetImagingSettings"))
            .Content!.ReadAsStringAsync();
        Assert.Contains("video_source_1", imagingRequestBody);
    }

    private sealed class RoutingStubHandler(List<HttpRequestMessage> captured, Func<HttpRequestMessage, HttpResponseMessage> respond)
        : HttpMessageHandler
    {
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            if (request.Content is not null)
            {
                var clone = new StringContent(await request.Content.ReadAsStringAsync(ct), Encoding.UTF8);
                captured.Add(new HttpRequestMessage(request.Method, request.RequestUri) { Content = clone });
            }
            else
            {
                captured.Add(request);
            }
            return respond(request);
        }
    }
}
