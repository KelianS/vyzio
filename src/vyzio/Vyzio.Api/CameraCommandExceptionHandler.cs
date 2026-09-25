using Microsoft.AspNetCore.Diagnostics;
using Vyzio.Core.Interfaces;

namespace Vyzio.Api;

// The camera's own failure, named by a code the interface branches on rather than by the status (ADR-56).
internal sealed class CameraCommandExceptionHandler : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext, Exception exception, CancellationToken ct)
    {
        var error = exception switch
        {
            CameraCommandRefusedException => "camera_refused",
            CameraUnreachableException => "camera_unreachable",
            _ => null,
        };
        if (error is null)
        {
            return false;
        }

        httpContext.Response.StatusCode = StatusCodes.Status502BadGateway;
        await httpContext.Response.WriteAsJsonAsync(new { error, message = exception.Message }, ct);
        return true;
    }
}
