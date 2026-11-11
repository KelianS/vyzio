using Microsoft.AspNetCore.Http.HttpResults;

namespace Vyzio.Api;

// The one shape of every error the API returns: a code the interface branches on, a detail for support (BACKEND-18).
internal static class ApiProblem
{
    public const string CodeKey = "code";

    public static ProblemHttpResult Of(int status, string code, string detail)
        => TypedResults.Problem(
            detail: detail,
            statusCode: status,
            extensions: new Dictionary<string, object?> { [CodeKey] = code });

    public static ProblemHttpResult BadRequest(string code, string detail)
        => Of(StatusCodes.Status400BadRequest, code, detail);

    public static ProblemHttpResult NotFound(string code, string detail)
        => Of(StatusCodes.Status404NotFound, code, detail);

    public static ProblemHttpResult Conflict(string code, string detail)
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

        // A binding failure also arrives as an exception, in Development: its status says it is the caller's.
        if (context.Exception is { } exception && problem.Status is null or >= StatusCodes.Status500InternalServerError)
        {
            problem.Extensions[CodeKey] = "unexpected_error";
            problem.Detail = exception.GetType().Name;
            return;
        }

        var (code, detail) = problem.Status switch
        {
            StatusCodes.Status400BadRequest => ("bad_request", "The request could not be read."),
            StatusCodes.Status401Unauthorized => ("unauthorized", "No valid session came with the request."),
            StatusCodes.Status403Forbidden => ("forbidden", "This session may not do this."),
            StatusCodes.Status404NotFound => ("not_found", "Nothing answers at this address."),
            StatusCodes.Status405MethodNotAllowed => ("method_not_allowed", "This address does not take this method."),
            StatusCodes.Status429TooManyRequests => ("too_many_requests", "Too many attempts; wait before trying again."),
            >= StatusCodes.Status500InternalServerError => ("unexpected_error", "The server failed without saying why."),
            _ => ("request_refused", "The request was refused."),
        };
        problem.Extensions[CodeKey] = code;
        problem.Detail ??= detail;
    }
}
