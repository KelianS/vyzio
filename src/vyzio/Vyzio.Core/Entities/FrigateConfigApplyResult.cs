namespace Vyzio.Core.Entities;

public sealed record FrigateConfigApplyResult(
    bool Applied,
    string Message,
    string ConfigPath);