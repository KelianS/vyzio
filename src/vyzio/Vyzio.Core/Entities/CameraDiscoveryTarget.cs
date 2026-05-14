namespace Vyzio.Core.Entities;

public sealed record CameraDiscoveryTarget(
    string Host,
    int? Port = null);