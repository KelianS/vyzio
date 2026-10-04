using System.Text.Json;
using Vyzio.Infrastructure.VendorAdapters;

namespace Vyzio.Tests.Contracts;

public sealed class FixtureHygieneTests
{
    // The 113 first bytes of a V380 auth frame whose password is not the fixture account's.
    private const string V380FrameWithAnotherPassword =
        "8f040000fe03000002010000004e61bc000000000000000000000000000000000000000000000000000000000000000000666978747572652d7573657200000000000000000000000000000000000000006162636465666768696a6b6c6d6e6f70f612f3b9c08fe4018bd684318643ed85";

    private const string V380FrameWithTheFixturePassword =
        "8f040000fe03000002010000004e61bc000000000000000000000000000000000000000000000000000000000000000000666978747572652d7573657200000000000000000000000000000000000000006162636465666768696a6b6c6d6e6f70bf0f637ea86d91591a57d826c0fda0d4";

    public static TheoryData<string> EveryFixture() => [.. FixtureLoader.EveryFile()];

    [Theory]
    [MemberData(nameof(EveryFixture))]
    public void Leaks_ShouldFindNothing_WhenScanningACommittedFixture(string fixture)
    {
        // Arrange
        var hygiene = FixtureHygiene.FromNeutralValues();
        var content = FixtureLoader.LoadText(fixture);

        // Act
        var leaks = hygiene.Leaks(content);

        // Assert
        Assert.Empty(leaks);
    }

    [Theory]
    [InlineData("""{"body":"http://10.1.2.3/onvif/device_service"}""", "private IP address")]
    [InlineData("""{"body":"c=IN IP4 172.20.0.5"}""", "private IP address")]
    [InlineData("""{"text":"NVDEVRESULT^192.168.0.12^"}""", "private IP address")]
    [InlineData("""{"hex":"c0a80001203139322e3136382e302e3132"}""", "private IP address")]
    [InlineData("""{"body":"inet6 fe80::3e84:6aff:fe12:3456"}""", "private IPv6 address")]
    [InlineData("""{"body":"<MAC>3c:84:6a:12:34:56</MAC>"}""", "MAC address")]
    [InlineData("""{"body":"{\"MAC\":\"3C846A123456\"}"}""", "MAC address")]
    [InlineData("""{"body":"-----BEGIN RSA PRIVATE KEY-----"}""", "private key")]
    [InlineData("""{"body":"<wsse:Username>someone</wsse:Username>"}""", "WS-Security username")]
    [InlineData("""{"body":"<wsse:Password Type=\"#PasswordText\">secret</wsse:Password>"}""", "WS-Security password")]
    [InlineData("""{"body":"{\"UserName\":\"someone\"}"}""", "DVRIP username")]
    [InlineData("""{"body":"{\"PassWord\":\"abcd1234\"}"}""", "DVRIP password hash")]
    [InlineData("""{"body":"{ \"AdminToken\" : \"c29tZS1kZXZpY2UtdG9rZW4=\" }"}""", "DVRIP admin token")]
    [InlineData("""{"text":"Authorization: Basic c29tZW9uZTpzZWNyZXQ="}""", "Basic authorization")]
    [InlineData("""{"text":"DESCRIBE rtsp://192.0.2.10:554/stream1 RTSP/1.0\r\nAuthorization: Digest username=\"fixture-user\", realm=\"R\", nonce=\"N\", uri=\"rtsp://192.0.2.10:554/stream1\", response=\"b5f7e59c557669a0b54afb8b262a922f\"\r\n"}""", "RTSP Digest authorization")]
    [InlineData("""{"body":"rtsp://192.0.2.10/user=fixture-user&password=secret&channel=1"}""", "password in an address")]
    [InlineData("{\"hex\":\"" + V380FrameWithAnotherPassword + "\"}", "V380 password")]
    public void Leaks_ShouldReportTheLeak_WhenAFixtureHoldsAPrivateValue(string fixture, string expectedLeak)
    {
        // Arrange
        var hygiene = FixtureHygiene.FromNeutralValues();

        // Act
        var leaks = hygiene.Leaks(fixture);

        // Assert
        Assert.Contains(expectedLeak, leaks);
    }

    [Theory]
    [InlineData("""{"body":"rtsp://192.0.2.10:554/stream1"}""")]
    [InlineData("""{"body":"<MAC>00:00:5E:00:53:01</MAC>"}""")]
    [InlineData("""{"body":"{\"MAC\":\"00005E005301\",\"IPv6\":\"2001:db8::1\"}"}""")]
    [InlineData("""{"body":"<wsse:Username>fixture-user</wsse:Username>"}""")]
    [InlineData("""{"body":"{ \"AdminToken\" : \"Zml4dHVyZS1hZG1pbi10b2tlbi0wMDAwMDAwMDAwMDA=\" }"}""")]
    [InlineData("""{"body":"{\"EncryptType\":\"MD5\",\"LoginType\":\"DVRIP\",\"PassWord\":\"tlJwpbo6\",\"UserName\":\"admin\"}"}""")]
    [InlineData("""{"text":"DESCRIBE rtsp://192.0.2.10:554/stream1 RTSP/1.0\r\nAuthorization: Digest username=\"fixture-user\", realm=\"R\", nonce=\"N\", uri=\"rtsp://192.0.2.10:554/stream1\", response=\"f9bf024e5299292084a2775c8af03e78\"\r\n"}""")]
    [InlineData("""{"body":"rtsp://192.0.2.10/user=fixture-user&password=fixture-pass&channel=1"}""")]
    [InlineData("{\"hex\":\"" + V380FrameWithTheFixturePassword + "\"}")]
    public void Leaks_ShouldFindNothing_WhenAFixtureHoldsOnlyNeutralValues(string fixture)
    {
        // Arrange
        var hygiene = FixtureHygiene.FromNeutralValues();

        // Act
        var leaks = hygiene.Leaks(fixture);

        // Assert
        Assert.Empty(leaks);
    }

    [Theory]
    [InlineData("fixture-pass", false)]
    [InlineData("a-real-password", true)]
    public void Leaks_ShouldReportTheDigestOnlyIfAnotherPasswordSignedIt_WhenScanningAnOnvifEnvelope(string password, bool expectedLeak)
    {
        // Arrange
        var hygiene = FixtureHygiene.FromNeutralValues();
        var envelope = OnvifEnvelope.Build("fixture-user", password, "<GetDeviceInformation xmlns=\"http://www.onvif.org/ver10/device/wsdl\"/>");
        var fixture = JsonSerializer.Serialize(new { body = envelope });

        // Act
        var leaks = hygiene.Leaks(fixture);

        // Assert
        Assert.Equal(expectedLeak, leaks.Contains("WS-Security password"));
    }
}
