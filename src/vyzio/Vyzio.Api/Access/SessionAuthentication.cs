using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;
using Vyzio.Application.DTOs.Access;
using Vyzio.Application.UseCases.Access;
using Vyzio.Core.Common;
using Vyzio.Core.Entities;

namespace Vyzio.Api.Access;

/// <summary>
/// The one way in: an opaque cookie resolved against a session the server can revoke (ADR-54).
/// The cookie is never read anywhere else — a route asks who is calling, not what was sent.
/// </summary>
public static class SessionAuthentication
{
    public const string Scheme = "VyzioSession";
    public const string CookieName = "vyzio_session";

    public static void WriteCookie(HttpResponse response, string token, DateTimeOffset expiresAt)
    {
        ArgumentNullException.ThrowIfNull(response);

        response.Cookies.Append(CookieName, token, new CookieOptions
        {
            HttpOnly = true,
            SameSite = SameSiteMode.Lax,
            // Only once the transport is encrypted: set today, the cookie would never come back (ADR-54).
            Secure = response.HttpContext.Request.IsHttps,
            Path = "/",
            Expires = expiresAt
        });
    }

    public static void ClearCookie(HttpResponse response)
    {
        ArgumentNullException.ThrowIfNull(response);

        response.Cookies.Delete(CookieName, new CookieOptions
        {
            HttpOnly = true,
            SameSite = SameSiteMode.Lax,
            Secure = response.HttpContext.Request.IsHttps,
            Path = "/"
        });
    }

    /// <summary>When the current session lapses, carried so a route never has to re-read the cookie.</summary>
    public const string ExpiryClaim = "vyzio:session_expires_at";

    /// <summary>The account behind the current request, or null when nobody is signed in.</summary>
    public static AuthenticatedSession? CurrentSession(this HttpContext context)
    {
        ArgumentNullException.ThrowIfNull(context);

        var id = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
        var role = context.User.FindFirstValue(ClaimTypes.Role);
        var expiry = context.User.FindFirstValue(ExpiryClaim);

        if (id is null
            || !SnakeCaseEnum.TryFromSnakeCase<AccountRole>(role, out var parsed)
            || !DateTimeOffset.TryParse(expiry, out var expiresAt)) return null;

        return new AuthenticatedSession(id, parsed, expiresAt);
    }
}

public sealed class SessionAuthenticationHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    AuthenticateSessionUseCase authenticate) : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (Request.Cookies[SessionAuthentication.CookieName] is not { Length: > 0 } token)
            return AuthenticateResult.NoResult();

        var session = await authenticate.ExecuteAsync(token, Context.RequestAborted);
        if (session is null)
        {
            // Nothing to keep: a cookie that no longer opens is dead weight on every later request.
            SessionAuthentication.ClearCookie(Response);
            return AuthenticateResult.NoResult();
        }

        var identity = new ClaimsIdentity(
            [
                new Claim(ClaimTypes.NameIdentifier, session.AccountId),
                new Claim(ClaimTypes.Role, SnakeCaseEnum.ToSnakeCase(session.Role)),
                new Claim(SessionAuthentication.ExpiryClaim, session.ExpiresAt.ToString("O"))
            ],
            SessionAuthentication.Scheme);

        return AuthenticateResult.Success(
            new AuthenticationTicket(new ClaimsPrincipal(identity), SessionAuthentication.Scheme));
    }
}
