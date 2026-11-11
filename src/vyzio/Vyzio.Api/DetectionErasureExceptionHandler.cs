using Microsoft.AspNetCore.Diagnostics;
using Vyzio.Core.Interfaces;

namespace Vyzio.Api;

// The surveillance refused or dropped an erasure; the message says how far it got, for support (SPECS 1.5).
internal sealed class DetectionErasureExceptionHandler : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext, Exception exception, CancellationToken ct)
    {
        if (exception is not DetectionErasureFailedException)
        {
            return false;
        }

        httpContext.Response.StatusCode = StatusCodes.Status502BadGateway;
        await httpContext.Response.WriteAsJsonAsync(new { error = "erasure_failed", message = exception.Message }, ct);
        return true;
    }
}
