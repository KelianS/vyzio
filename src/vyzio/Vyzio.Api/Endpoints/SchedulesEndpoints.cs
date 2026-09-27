using Vyzio.Application.DTOs.Scheduling;
using Vyzio.Application.UseCases.Scheduling;

namespace Vyzio.Api.Endpoints;

/// <summary>The house's scheduled rules, one route set for every type (ADR-63).</summary>
public static class SchedulesEndpoints
{
    public static IEndpointRouteBuilder MapSchedules(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/schedules");

        group.MapGet("/", async (ListScheduleRulesUseCase useCase, CancellationToken ct) =>
            Results.Ok(await useCase.ExecuteAsync(ct)));

        group.MapGet("/{id}", async (string id, GetScheduleRuleUseCase useCase, CancellationToken ct) =>
            await useCase.ExecuteAsync(id, ct) is { } dto ? Results.Ok(dto) : Results.NotFound());

        group.MapPost("/", async (CreateScheduleRuleRequest request, CreateScheduleRuleUseCase useCase, CancellationToken ct) =>
        {
            var dto = await useCase.ExecuteAsync(request, ct);
            return Results.Created($"/api/schedules/{dto.Id}", dto);
        });

        group.MapPut("/{id}", async (string id, UpdateScheduleRuleRequest request, UpdateScheduleRuleUseCase useCase, CancellationToken ct) =>
            await useCase.ExecuteAsync(id, request, ct) is { } dto ? Results.Ok(dto) : Results.NotFound());

        group.MapDelete("/{id}", async (string id, DeleteScheduleRuleUseCase useCase, CancellationToken ct) =>
            await useCase.ExecuteAsync(id, ct) ? Results.NoContent() : Results.NotFound());

        return app;
    }
}
