using System.Net;
using System.Text;
using System.Threading.Channels;
using System.Xml;
using System.Xml.Linq;
using Vyzio.Tests.Contracts;

namespace Vyzio.Tests.Services;

// An ONVIF camera answering each SOAP action with what a real one answered (#92), or with a hand-written body for a shape no capture holds.
internal sealed class FakeOnvifCamera : HttpMessageHandler
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

    private static readonly XNamespace Soap = "http://www.w3.org/2003/05/soap-envelope";

    private readonly Dictionary<string, Answer[]> _answers;
    private readonly Dictionary<string, int> _asked = [];

    private readonly Channel<(string Body, DateTimeOffset At)> _arrivals =
        Channel.CreateUnbounded<(string Body, DateTimeOffset At)>();

    private readonly TaskCompletionSource _movesAnswered = new(TaskCreationOptions.RunContinuationsAsynchronously);

    // A hand-written camera: a null body is refused with a 404.
    public FakeOnvifCamera(string profiles, string? configurationOptions, string presets = NoPresetsXml)
        : this(
            new Dictionary<string, Answer[]>
            {
                ["GetProfiles"] = [Answer.Soap(profiles)],
                ["GetConfigurationOptions"] = [configurationOptions is null ? Answer.NotFound : Answer.Soap(configurationOptions)],
                ["GetPresets"] = [Answer.Soap(presets)],
            })
    {
    }

    private FakeOnvifCamera(Dictionary<string, Answer[]> answers) => _answers = answers;

    // Replays these scenarios of one captured ONVIF variant, on any path: the client asks at announced addresses the capture did not.
    // An action captured several times answers in order, then repeats its last.
    public static FakeOnvifCamera Replaying(string variant, params string[] scenarios)
    {
        var captured = FixtureLoader.Variant(FixtureProtocol.Onvif, variant);
        return new FakeOnvifCamera(scenarios
            .SelectMany(scenario => captured.Transcript(scenario).Messages.Chunk(2))
            .GroupBy(exchange => ActionOf(exchange[0].Body ?? string.Empty))
            .ToDictionary(group => group.Key, group => group.Select(exchange => Answer.Captured(exchange[1])).ToArray()));
    }

    public List<string> Bodies { get; } = [];

    // The clock each request is stamped with on arrival.
    public TimeProvider Clock { get; init; } = TimeProvider.System;

    // A slow camera: a continuous move is answered only once AnswerMoves is called.
    public bool HoldsMoveAnswers { get; init; }

    public void AnswerMoves() => _movesAnswered.TrySetResult();

    // When the next request carrying this ONVIF element reached the camera, on its clock.
    public async Task<DateTimeOffset> NextArrivalAsync(string element)
    {
        while (true)
        {
            var (body, at) = await _arrivals.Reader.ReadAsync();
            if (body.Contains($"<{element}", StringComparison.Ordinal)) return at;
        }
    }

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        var body = request.Content is null ? string.Empty : await request.Content.ReadAsStringAsync(ct);
        lock (Bodies) Bodies.Add(body);
        _arrivals.Writer.TryWrite((body, Clock.GetUtcNow()));
        if (HoldsMoveAnswers && body.Contains("<ContinuousMove", StringComparison.Ordinal))
            await _movesAnswered.Task.WaitAsync(ct);

        // A command no capture holds (captures never move the head) is accepted without a word.
        return (NextAnswer(ActionOf(body)) ?? Answer.Soap(EmptyAnswerXml)).ToResponse();
    }

    private Answer? NextAnswer(string action)
    {
        if (!_answers.TryGetValue(action, out var answers)) return null;
        lock (_asked)
        {
            var asked = _asked.GetValueOrDefault(action);
            _asked[action] = asked + 1;
            return answers[Math.Min(asked, answers.Length - 1)];
        }
    }

    // The SOAP action is the operation the envelope's body carries: most requests send no action header.
    private static string ActionOf(string envelope)
    {
        try
        {
            return XDocument.Parse(envelope).Root?.Element(Soap + "Body")?.Elements().FirstOrDefault()?.Name.LocalName ?? string.Empty;
        }
        catch (XmlException)
        {
            return string.Empty;
        }
    }

    private sealed record Answer(HttpStatusCode Status, string? Reason, IReadOnlyList<IReadOnlyList<string>> Headers, string Body)
    {
        public static readonly Answer NotFound = new(HttpStatusCode.NotFound, null, [], string.Empty);

        public static Answer Soap(string body) => new(HttpStatusCode.OK, null, [["Content-Type", "application/soap+xml; charset=utf-8"]], body);

        public static Answer Captured(TranscriptMessage response)
            => new((HttpStatusCode)response.Status!.Value, response.Reason, response.Headers ?? [], response.Body ?? string.Empty);

        public HttpResponseMessage ToResponse()
        {
            var bytes = Encoding.UTF8.GetBytes(Body);
            var content = new ByteArrayContent(bytes);
            var response = new HttpResponseMessage(Status) { ReasonPhrase = Reason, Content = content };
            foreach (var header in Headers)
            {
                if (!response.Headers.TryAddWithoutValidation(header[0], header[1]))
                    content.Headers.TryAddWithoutValidation(header[0], header[1]);
            }
            // The captured length counted the private values the neutral ones replaced.
            content.Headers.ContentLength = bytes.Length;
            return response;
        }
    }
}
