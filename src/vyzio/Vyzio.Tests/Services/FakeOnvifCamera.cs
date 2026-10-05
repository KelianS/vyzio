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

    // No capture holds a GetNode answer yet: the shape of the ONVIF PTZ specification, with the room a test gives it.
    public static string NodeXml(int maximumPresets) => $"""
        <s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope">
          <s:Body>
            <tptz:GetNodeResponse xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl" xmlns:tt="http://www.onvif.org/ver10/schema">
              <tptz:PTZNode token="node_1" FixedHomePosition="false">
                <tt:Name>node_1</tt:Name>
                <tt:MaximumNumberOfPresets>{maximumPresets}</tt:MaximumNumberOfPresets>
                <tt:HomeSupported>false</tt:HomeSupported>
              </tptz:PTZNode>
            </tptz:GetNodeResponse>
          </s:Body>
        </s:Envelope>
        """;

    // Carries an ONVIF marker, so a port sweep recognises the camera (ADR-56).
    private const string EmptyAnswerXml = """
        <s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:tds="http://www.onvif.org/ver10/device/wsdl"><s:Body/></s:Envelope>
        """;

    private static readonly XNamespace Soap = "http://www.w3.org/2003/05/soap-envelope";

    // Captures never move the head, so a replay accepts these without a word and refuses any other action it holds no answer to.
    private static readonly HashSet<string> MoveCommands = ["ContinuousMove", "RelativeMove", "Stop"];

    private readonly Dictionary<string, Answer[]> _answers;
    private readonly Func<string, Answer> _unanswered;
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
            },
            unanswered: _ => Answer.Soap(EmptyAnswerXml))
    {
    }

    private FakeOnvifCamera(Dictionary<string, Answer[]> answers, Func<string, Answer> unanswered)
    {
        _answers = answers;
        _unanswered = unanswered;
    }

    // Captured answers in order, the last repeated, on any path: the client asks at announced addresses the capture did not.
    public static FakeOnvifCamera Replaying(string variant, params string[] scenarios)
    {
        var captured = FixtureLoader.Variant(FixtureProtocol.Onvif, variant);
        return new FakeOnvifCamera(
            scenarios
                .SelectMany(scenario => Exchanges(variant, scenario, captured.Transcript(scenario).Messages))
                .GroupBy(exchange => ActionOf(exchange.Request.Body ?? string.Empty))
                .ToDictionary(group => group.Key, group => group.Select(exchange => Answer.Captured(exchange.Response)).ToArray()),
            unanswered: action => MoveCommands.Contains(action) ? Answer.Soap(EmptyAnswerXml) : Answer.NotCaptured(variant, action));
    }

    // A hand-written answer to an action no capture holds, beside the captured ones.
    public FakeOnvifCamera Answering(string action, string body)
    {
        _answers[action] = [Answer.Soap(body)];
        return this;
    }

    private static IEnumerable<(TranscriptMessage Request, TranscriptMessage Response)> Exchanges(string variant, string scenario, IReadOnlyList<TranscriptMessage> messages)
        => messages.Chunk(2).Select(pair => pair is [{ Direction: TranscriptDirection.Request } request, { Direction: TranscriptDirection.Response, Status: not null } response]
            ? (request, response)
            : throw new InvalidDataException($"{variant}/{scenario}: not a request answered with a status, the replay cannot serve it."));

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

        var action = ActionOf(body);
        return (NextAnswer(action) ?? _unanswered(action)).ToResponse();
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

        // Read back by the client as the fault text, so a failing test names the action nobody captured.
        public static Answer NotCaptured(string variant, string action) => new(
            HttpStatusCode.NotImplemented, null, [["Content-Type", "application/soap+xml; charset=utf-8"]],
            $"""<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"><s:Body><s:Fault><s:Reason><s:Text>{variant} has no captured answer to {action}</s:Text></s:Reason></s:Fault></s:Body></s:Envelope>""");

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
