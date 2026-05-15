using Vyzio.Application.DTOs.Profiles;
using Vyzio.Application.UseCases.Profiles;

namespace Vyzio.Api.Endpoints;

public static class ProfilesEndpoints
{
    public static IEndpointRouteBuilder MapProfiles(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/profiles");

        group.MapGet("/", async (GetProfilesUseCase useCase, CancellationToken ct) =>
            Results.Ok(await useCase.ExecuteAsync(ct)));

        group.MapGet("/{id}", async (string id, GetProfileByIdUseCase useCase, CancellationToken ct) =>
        {
            var dto = await useCase.ExecuteAsync(id, ct);
            return dto is null ? Results.NotFound() : Results.Ok(dto);
        });

        group.MapPost("/", async (CreateProfileRequest request, CreateProfileUseCase useCase, CancellationToken ct) =>
        {
            var dto = await useCase.ExecuteAsync(request, ct);
            return Results.Created($"/api/profiles/{dto.Id}", dto);
        });

        group.MapPut("/{id}", async (string id, UpdateProfileRequest request, UpdateProfileUseCase useCase, CancellationToken ct) =>
        {
            var dto = await useCase.ExecuteAsync(id, request, ct);
            return dto is null ? Results.NotFound() : Results.Ok(dto);
        });

        group.MapDelete("/{id}", async (string id, DeleteProfileUseCase useCase, CancellationToken ct) =>
        {
            var deleted = await useCase.ExecuteAsync(id, ct);
            return deleted ? Results.NoContent() : Results.NotFound();
        });

        // Photos
        group.MapGet("/{id}/photos", async (string id, GetProfilePhotosUseCase useCase, CancellationToken ct) =>
            Results.Ok(await useCase.ExecuteAsync(id, ct)));

        group.MapPost("/{id}/photos", async (
            string id,
            IFormFile file,
            AddProfilePhotoUseCase useCase,
            CancellationToken ct) =>
        {
            if (file is null || file.Length == 0)
                return Results.BadRequest("No file provided.");

            using var ms = new MemoryStream();
            await file.CopyToAsync(ms, ct);
            var bytes = ms.ToArray();

            try
            {
                var dto = await useCase.ExecuteAsync(id, file.FileName, bytes, ct);
                return Results.Created($"/api/profiles/{id}/photos/{dto.Id}", dto);
            }
            catch (KeyNotFoundException)
            {
                return Results.NotFound();
            }
        }).DisableAntiforgery();

        group.MapDelete("/{id}/photos/{photoId}", async (string id, string photoId, RemoveProfilePhotoUseCase useCase, CancellationToken ct) =>
        {
            var deleted = await useCase.ExecuteAsync(id, photoId, ct);
            return deleted ? Results.NoContent() : Results.NotFound();
        });

        group.MapPost("/resync-face-library", async (ResyncFaceLibraryUseCase useCase, CancellationToken ct) =>
        {
            var count = await useCase.ExecuteAsync(ct);
            return Results.Ok(new { synced = count });
        });

        // Camera links
        group.MapGet("/{id}/camera-links", async (string id, GetProfileCameraLinksUseCase useCase, CancellationToken ct) =>
            Results.Ok(await useCase.ExecuteAsync(id, ct)));

        group.MapPut("/{id}/camera-links", async (
            string id,
            SetProfileCameraLinksRequest request,
            SetProfileCameraLinksUseCase useCase,
            CancellationToken ct) =>
        {
            var links = await useCase.ExecuteAsync(id, request, ct);
            return Results.Ok(links);
        });

        return app;
    }
}
