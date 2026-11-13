using Microsoft.AspNetCore.Diagnostics;
using Vyzio.Core.Interfaces;

namespace Vyzio.Api;

// The camera's own failure, named by a code the interface branches on rather than by the status (ADR-04).
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

        await ApiProblem.Of(StatusCodes.Status502BadGateway, error, exception.Message).ExecuteAsync(httpContext);
        return true;
    }
}
