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

        return app;
    }
}
