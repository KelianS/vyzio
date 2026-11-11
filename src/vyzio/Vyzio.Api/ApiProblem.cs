using Microsoft.AspNetCore.Http.HttpResults;

namespace Vyzio.Api;

// The one shape of every error the API returns: a code the interface branches on, a detail for support (BACKEND-05).
internal static class ApiProblem
{
    public const string CodeKey = "code";

    public static ProblemHttpResult Of(int status, string code, string? detail = null)
        => TypedResults.Problem(
            detail: detail,
            statusCode: status,
            extensions: new Dictionary<string, object?> { [CodeKey] = code });

    public static ProblemHttpResult BadRequest(string code, string? detail = null)
        => Of(StatusCodes.Status400BadRequest, code, detail);

    public static ProblemHttpResult NotFound(string code, string? detail = null)
        => Of(StatusCodes.Status404NotFound, code, detail);

    public static ProblemHttpResult Conflict(string code, string? detail = null)
        => Of(StatusCodes.Status409Conflict, code, detail);

    /// <summary>
    /// Names what nobody named: a status-code page, a binding failure, an unhandled exception. An unhandled
    /// exception's message may hold a camera address, so only its type leaves; the trace id finds the rest.
    /// </summary>
    public static void Complete(ProblemDetailsContext context)
    {
        ArgumentNullException.ThrowIfNull(context);

        var problem = context.ProblemDetails;
        if (problem.Extensions.ContainsKey(CodeKey)) return;

        if (context.Exception is { } exception)
        {
            problem.Extensions[CodeKey] = "unexpected_error";
            problem.Detail = exception.GetType().Name;
            return;
        }

        problem.Extensions[CodeKey] = problem.Status switch
        {
            StatusCodes.Status400BadRequest => "bad_request",
            StatusCodes.Status401Unauthorized => "unauthorized",
            StatusCodes.Status403Forbidden => "forbidden",
            StatusCodes.Status404NotFound => "not_found",
            StatusCodes.Status405MethodNotAllowed => "method_not_allowed",
            StatusCodes.Status429TooManyRequests => "too_many_requests",
            >= StatusCodes.Status500InternalServerError => "unexpected_error",
            _ => "request_refused",
        };
    }
}
