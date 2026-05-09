using System.ComponentModel.DataAnnotations;

namespace Vyzio.Application.DTOs.Profiles;

public sealed record CreateProfileRequest(
    [Required, MaxLength(200)] string Name,
    string Category = "other",
    string AlertMode = "notify");

public sealed record UpdateProfileRequest(
    [Required, MaxLength(200)] string Name,
    string Category,
    string AlertMode);
