using Microsoft.AspNetCore.Diagnostics;
using Vyzio.Core.Interfaces;

namespace Vyzio.Api;

/// <summary>
/// The surveillance not answering is a state the screens must name, not a 500 they can only shrug
/// at: without it there is no history at all, and that is not an empty history (ADR-12).
/// </summary>
internal sealed class FrigateUnavailableExceptionHandler : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext, Exception exception, CancellationToken ct)
    {
        if (exception is not FrigateUnavailableException)
        {
            return false;
        }

        await ApiProblem.Of(StatusCodes.Status503ServiceUnavailable, "surveillance_unavailable", exception.Message)
            .ExecuteAsync(httpContext);
        return true;
    }
}
