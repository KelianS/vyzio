using Microsoft.AspNetCore.RateLimiting;
using Vyzio.Api.Access;
using Vyzio.Application.DTOs.Access;
using Vyzio.Application.UseCases.Access;

namespace Vyzio.Api.Endpoints;

/// <summary>
/// The only routes that answer without a session, and only until an owner exists (ADR-54).
/// </summary>
public static class AccessEndpoints
{
    /// <summary>Ten tries per window is generous for a household and hopeless for a guesser.</summary>
    public const string SignInRateLimitPolicy = "sign-in";

    public static IEndpointRouteBuilder MapAccess(this IEndpointRouteBuilder app)
    {
        // Asked before anyone can be signed in: it is what tells a fresh install from a locked one.
        app.MapGet("/api/access/state", async (
            GetAccessStateUseCase useCase,
            CancellationToken ct) => Results.Ok(await useCase.ExecuteAsync(ct))).AllowAnonymous();

        app.MapPost("/api/access/account", async (
            PasswordRequest request,
            HttpContext context,
            CreateOwnerAccountUseCase useCase,
            CancellationToken ct) =>
        {
            var outcome = await useCase.ExecuteAsync(request?.Password, DeviceOf(context), ct);
            // Not rate limited: this route sets the secret instead of guessing it, and it closes for
            // good once an owner exists. Throttling it would only lock someone out of their install.
            return Grant(context, outcome);
        }).AllowAnonymous();

        app.MapPost("/api/access/session", async (
            PasswordRequest request,
            HttpContext context,
            SignInUseCase useCase,
            CancellationToken ct) =>
        {
            var outcome = await useCase.ExecuteAsync(request?.Password, DeviceOf(context), ct);
            return Grant(context, outcome);
        }).AllowAnonymous().RequireRateLimiting(SignInRateLimitPolicy);

        app.MapGet("/api/access/session", (HttpContext context) =>
            context.CurrentSession() is { } session
                ? Results.Ok(CurrentSessionDto.From(session))
                : Results.Unauthorized());

        app.MapDelete("/api/access/session", async (
            HttpContext context,
            SignOutUseCase useCase,
            CancellationToken ct) =>
        {
            if (context.Request.Cookies[SessionAuthentication.CookieName] is { Length: > 0 } token)
                await useCase.ExecuteAsync(token, ct);

            // Signing out is never a failure: an already dead cookie leaves with the same answer.
            SessionAuthentication.ClearCookie(context.Response);
            return Results.NoContent();
            // Anonymous on purpose: signing out with a cookie that already died must not be an error.
        }).AllowAnonymous();

        // Guarded, and it re-opens a session in the same answer: changing the password closes every
        // device, and the one that asked for it would otherwise lock itself out (ADR-54).
        app.MapPut("/api/access/password", async (
            ChangePasswordRequest request,
            HttpContext context,
            ChangePasswordUseCase useCase,
            CancellationToken ct) =>
        {
            if (context.CurrentSession() is not { } session) return Results.Unauthorized();

            var outcome = await useCase.ExecuteAsync(
                session.AccountId, request?.CurrentPassword, request?.NewPassword, DeviceOf(context), ct);

            return Grant(context, outcome);
        });

        app.MapDelete("/api/access/sessions", async (
            HttpContext context,
            SignOutEverywhereUseCase useCase,
            CancellationToken ct) =>
        {
            if (context.CurrentSession() is not { } session) return Results.Unauthorized();

            var closed = await useCase.ExecuteAsync(session.AccountId, ct);
            SessionAuthentication.ClearCookie(context.Response);
            return Results.Ok(new { closed });
        });

        return app;
    }

    private static IResult Grant(HttpContext context, AccessOutcome outcome)
    {
        if (!outcome.Granted) return Refuse(outcome.Refusal);

        SessionAuthentication.WriteCookie(context.Response, outcome.Token!, outcome.Session!.ExpiresAt);
        return Results.Ok(CurrentSessionDto.From(outcome.Session));
    }

    private static IResult Refuse(AccessRefusal refusal) => refusal switch
    {
        AccessRefusal.AlreadyInstalled => Results.Conflict(new { error = "already_installed" }),
        AccessRefusal.PasswordTooShort => Results.BadRequest(new { error = "password_too_short" }),
        // Deliberately not 401: the caller holds a live session, and the interface reads 401 as "you were
        // signed out" — answering that here would close a screen instead of refusing one field.
        AccessRefusal.CurrentPasswordWrong => Results.BadRequest(new { error = "wrong_password" }),
        // Same answer whether the account is missing or the password wrong: telling them apart helps only a guesser.
        AccessRefusal.NotInstalled or AccessRefusal.WrongPassword => Results.Unauthorized(),
        _ => Results.Unauthorized()
    };

    /// <summary>What the user will recognise in the session list — nothing more is kept of the device.</summary>
    private static string? DeviceOf(HttpContext context)
    {
        var agent = context.Request.Headers.UserAgent.ToString();
        return string.IsNullOrWhiteSpace(agent) ? null : agent[..Math.Min(agent.Length, 200)];
    }
}
