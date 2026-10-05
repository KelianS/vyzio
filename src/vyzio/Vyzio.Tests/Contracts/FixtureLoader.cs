using System.Text.Json;
using System.Text.Json.Serialization;

namespace Vyzio.Tests.Contracts;

// One home for reading Contracts/Fixtures: raw files, the neutral values, and the captured camera variants (#92).
internal static class FixtureLoader
{
    private static readonly string Root = Path.Combine(AppContext.BaseDirectory, "Contracts", "Fixtures");

    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) },
    };

    private static readonly Lazy<NeutralValues> LazyNeutral = new(() => Deserialize<NeutralValues>("neutral-values.json"));

    public static NeutralValues Neutral => LazyNeutral.Value;

    public static string LoadText(string relativePath)
        => File.ReadAllText(Path.Combine(Root, relativePath.Replace('/', Path.DirectorySeparatorChar)));

    // Every fixture file, relative to the fixtures root.
    public static IReadOnlyList<string> EveryFile()
        => [.. Directory.EnumerateFiles(Root, "*.json", SearchOption.AllDirectories)
            .Select(path => Path.GetRelativePath(Root, path).Replace(Path.DirectorySeparatorChar, '/'))
            .Order(StringComparer.Ordinal)];

    // Every `<model>-<firmware>` folder of a protocol, found by its manifest: a new firmware needs no code.
    public static IReadOnlyList<FixtureVariant> Variants(FixtureProtocol protocol)
        => [.. Directory.EnumerateDirectories(Path.Combine(Root, FolderOf(protocol)))
            .Where(folder => File.Exists(Path.Combine(folder, "manifest.json")))
            .Select(folder => Variant(protocol, Path.GetFileName(folder)))
            .OrderBy(variant => variant.Name, StringComparer.Ordinal)];

    public static FixtureVariant Variant(FixtureProtocol protocol, string name)
    {
        var manifest = Deserialize<Manifest>($"{FolderOf(protocol)}/{name}/manifest.json");
        return new FixtureVariant(
            protocol,
            name,
            manifest.Firmware,
            [.. manifest.Scenarios.Select(scenario => Path.GetFileNameWithoutExtension(scenario.File))]);
    }

    // The variant names as xUnit theory data, one test case per captured variant.
    public static TheoryData<string> VariantNames(FixtureProtocol protocol)
        => [.. Variants(protocol).Select(variant => variant.Name)];

    internal static Transcript LoadTranscript(FixtureProtocol protocol, string variant, string scenario)
        => Deserialize<Transcript>($"{FolderOf(protocol)}/{variant}/{scenario}.json");

    private static T Deserialize<T>(string relativePath)
        => JsonSerializer.Deserialize<T>(LoadText(relativePath), Json)
           ?? throw new InvalidDataException($"Empty fixture {relativePath}.");

    private static string FolderOf(FixtureProtocol protocol) => protocol switch
    {
        FixtureProtocol.Onvif => "onvif",
        FixtureProtocol.Rtsp => "rtsp",
        FixtureProtocol.Dvrip => "dvrip",
        FixtureProtocol.V380 => "v380",
        _ => throw new ArgumentOutOfRangeException(nameof(protocol), protocol, null),
    };

    private sealed record Manifest(string Firmware, IReadOnlyList<ManifestScenario> Scenarios);

    private sealed record ManifestScenario(string File);
}

// The captured variants tests name; one camera keeps the same folder name under each protocol.
internal static class CapturedVariant
{
    public const string Icsee = "icsee-v5.04.c02.000959tc.10000.140835.0000000";
    public const string TapoC200 = "tapo-c200-1.9.1-build-260326-rel.26771n";
    public const string V380Pro = "v380-pro-hs-camera-no1";
}

// The RTSP path each captured camera was described on.
internal static class CapturedStreamPath
{
    public const string TapoC200 = "/stream1";
    public const string V380Pro = "/live/ch00_1";
}

internal enum FixtureProtocol
{
    Onvif,
    Rtsp,
    Dvrip,
    V380,
}

// One camera model on one firmware, as captured by tools/camera-capture.
internal sealed record FixtureVariant(
    FixtureProtocol Protocol,
    string Name,
    string Firmware,
    IReadOnlyList<string> Scenarios)
{
    // Only a scenario its manifest lists: a misspelt name fails here, not as a silent empty replay.
    public Transcript Transcript(string scenario)
        => Scenarios.Contains(scenario)
            ? FixtureLoader.LoadTranscript(Protocol, Name, scenario)
            : throw new ArgumentException($"{Protocol}/{Name} has no captured scenario '{scenario}'.", nameof(scenario));

    public override string ToString() => Name;
}

// The messages of one scenario, in the order they crossed the wire.
internal sealed record Transcript(IReadOnlyList<TranscriptMessage> Messages);

// One message as recorded: an HTTP request or response, or a TCP frame as text, hex or a DVRIP header and body; a capture with an event holds no bytes.
internal sealed record TranscriptMessage(
    TranscriptDirection Direction,
    int? Status = null,
    string? Reason = null,
    IReadOnlyList<IReadOnlyList<string>>? Headers = null,
    string? Body = null,
    string? Header = null,
    string? Hex = null,
    string? Text = null,
    TranscriptEvent? Event = null);

// Request and response for HTTP, sent and received for raw TCP.
internal enum TranscriptDirection
{
    Request,
    Response,
    Sent,
    Received,
}

// What the camera did instead of answering, recorded so a replay reproduces it.
internal enum TranscriptEvent
{
    Silence,
    Closed,
    Unreachable,
}

// The stable stand-ins the capture tool writes in place of every private value (neutral-values.json).
internal sealed record NeutralValues(
    FixtureAccount Account,
    string RefusedPassword,
    FixtureAccount ProbeAccount,
    string CameraHost,
    string MacPrefix,
    string DvripAdminToken,
    uint V380DeviceId);

internal sealed record FixtureAccount(string Username, string Password);
