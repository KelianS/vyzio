using Microsoft.AspNetCore.Diagnostics;
using Vyzio.Core.Interfaces;

namespace Vyzio.Api;

/// <summary>
/// A camera refusing a command is an answer, not a server fault: the screen must be able to say why
/// (privacy mode on, credentials rejected) instead of silently pretending the command went through
/// (ADR-56).
/// </summary>
internal sealed class CameraCommandRefusedExceptionHandler : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext, Exception exception, CancellationToken ct)
    {
        if (exception is not CameraCommandRefusedException refused)
        {
            return false;
        }

        httpContext.Response.StatusCode = StatusCodes.Status502BadGateway;
        await httpContext.Response.WriteAsJsonAsync(
            new { error = "camera_refused", message = refused.Message }, ct);
        return true;
    }
}
