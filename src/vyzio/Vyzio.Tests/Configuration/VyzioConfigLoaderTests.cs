using Vyzio.Infrastructure.Configuration;

namespace Vyzio.Tests.Configuration;

public class VyzioConfigLoaderTests
{
    private static Func<string, string?> Variables(Dictionary<string, string> values) =>
        name => values.GetValueOrDefault(name);

    [Theory]
    [InlineData("VYZIO_FRIGATE_MQTT_PORT", "abc", "VYZIO_FRIGATE_MQTT_PORT must be a whole number from 1 to 65535.")]
    [InlineData("VYZIO_FRIGATE_MQTT_PORT", "70000", "VYZIO_FRIGATE_MQTT_PORT must be a whole number from 1 to 65535.")]
    [InlineData("VYZIO_DISCOVERY_PROBE_TIMEOUT_MS", "10", "VYZIO_DISCOVERY_PROBE_TIMEOUT_MS must be a whole number from 50 to 5000.")]
    [InlineData("VYZIO_DISCOVERY_PROBE_TIMEOUT_MS", "2.5", "VYZIO_DISCOVERY_PROBE_TIMEOUT_MS must be a whole number from 50 to 5000.")]
    [InlineData("VYZIO_DISCOVERY_MAX_CONCURRENT_PROBES", "0", "VYZIO_DISCOVERY_MAX_CONCURRENT_PROBES must be a whole number from 1 to 256.")]
    [InlineData("VYZIO_DISCOVERY_MAX_CONCURRENT_PROBES", "-4", "VYZIO_DISCOVERY_MAX_CONCURRENT_PROBES must be a whole number from 1 to 256.")]
    [InlineData("VYZIO_TIME_ZONE", "Mars/Olympus", "VYZIO_TIME_ZONE must be a time zone name such as Europe/Paris.")]
    [InlineData("VYZIO_DATABASE_CONNECTION_STRING", "Data Sauce=./data/vyzio.db", "VYZIO_DATABASE_CONNECTION_STRING must be a SQLite connection string such as Data Source=./data/vyzio.db.")]
    [InlineData("VYZIO_DATABASE_CONNECTION_STRING", "Data Source=", "VYZIO_DATABASE_CONNECTION_STRING must be a SQLite connection string such as Data Source=./data/vyzio.db.")]
    [InlineData("VYZIO_DATABASE_CONNECTION_STRING", "./data/vyzio.db", "VYZIO_DATABASE_CONNECTION_STRING must be a SQLite connection string such as Data Source=./data/vyzio.db.")]
    [InlineData("VYZIO_FRIGATE_API_BASE_URL", "frigate:5000", "VYZIO_FRIGATE_API_BASE_URL must be an http address such as http://frigate:5000.")]
    public void Load_ShouldNameTheVariableAndTheExpectedValue_WhenASettingIsInvalid(string variable, string value, string expected)
    {
        // Act
        var load = VyzioConfigLoader.Load(Variables(new() { [variable] = value }));

        // Assert
        Assert.Equal([expected], load.Problems);
    }

    [Fact]
    public void Load_ShouldReportEveryInvalidSetting_WhenSeveralAreInvalid()
    {
        // Act
        var load = VyzioConfigLoader.Load(Variables(new()
        {
            ["VYZIO_FRIGATE_MQTT_PORT"] = "0",
            ["VYZIO_TIME_ZONE"] = "Mars/Olympus"
        }));

        // Assert
        Assert.Equal(2, load.Problems.Count);
    }

    [Fact]
    public void Load_ShouldKeepTheDefaults_WhenNoSettingIsGiven()
    {
        // Act
        var load = VyzioConfigLoader.Load(Variables([]));

        // Assert
        Assert.Empty(load.Problems);
        Assert.Equal(1883, load.Settings.Frigate.Mqtt.Port);
        Assert.Equal(250, load.Settings.Discovery.ProbeTimeoutMs);
        Assert.Equal(TimeZoneInfo.Local, load.Settings.TimeZone);
    }

    [Fact]
    public void Load_ShouldUseTheGivenValues_WhenTheyAreValid()
    {
        // Act
        var load = VyzioConfigLoader.Load(Variables(new()
        {
            ["VYZIO_FRIGATE_MQTT_PORT"] = "1884",
            ["VYZIO_DISCOVERY_MAX_CONCURRENT_PROBES"] = "256",
            ["VYZIO_TIME_ZONE"] = "Europe/Paris",
            ["VYZIO_FRIGATE_API_BASE_URL"] = "http://nvr.local:5000/"
        }));

        // Assert
        Assert.Empty(load.Problems);
        Assert.Equal(1884, load.Settings.Frigate.Mqtt.Port);
        Assert.Equal(256, load.Settings.Discovery.MaxConcurrentProbes);
        Assert.Equal("Europe/Paris", load.Settings.TimeZone.Id);
        Assert.Equal("http://nvr.local:5000", load.Settings.Frigate.ApiBaseUrl);
    }

    [Fact]
    public void Load_ShouldPlaceTheDataBesideTheDatabase_WhenTheConnectionStringCarriesOtherKeywords()
    {
        // Act
        var load = VyzioConfigLoader.Load(Variables(new()
        {
            ["VYZIO_DATABASE_CONNECTION_STRING"] = "Cache=Shared;Data Source=/srv/vyzio-data/vyzio.db"
        }));

        // Assert
        Assert.Empty(load.Problems);
        Assert.Equal("vyzio-data", Path.GetFileName(load.Settings.Database.DataDirectory));
    }
}
