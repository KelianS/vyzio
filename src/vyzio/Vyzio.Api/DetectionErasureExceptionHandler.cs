using Microsoft.AspNetCore.Diagnostics;
using Vyzio.Core.Interfaces;

namespace Vyzio.Api;

// The surveillance refused or dropped an erasure; the message says how far it got, for support (HIST-14).
internal sealed class DetectionErasureExceptionHandler : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext, Exception exception, CancellationToken ct)
    {
        if (exception is not DetectionErasureFailedException failure)
        {
            return false;
        }

        // The screen says either "nothing was erased" or "a retry finishes it" from this code alone.
        var error = failure.PartlyErased ? "erasure_incomplete" : "erasure_failed";
        await ApiProblem.Of(StatusCodes.Status502BadGateway, error, failure.Message).ExecuteAsync(httpContext);
        return true;
    }
}
