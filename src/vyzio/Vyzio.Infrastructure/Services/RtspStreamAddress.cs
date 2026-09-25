namespace Vyzio.Infrastructure.Services;

// The one way to write a camera's RTSP address, without its account: a query in the path stays a query.
internal static class RtspStreamAddress
{
    public static string Of(string host, int port, string? streamPath)
    {
        var separatorIndex = streamPath?.IndexOf('?') ?? -1;
        return new UriBuilder("rtsp", host, port)
        {
            Path = (separatorIndex >= 0 ? streamPath![..separatorIndex] : streamPath)?.TrimStart('/') ?? string.Empty,
            Query = separatorIndex >= 0 ? streamPath![(separatorIndex + 1)..] : string.Empty,
        }.Uri.ToString();
    }
}
